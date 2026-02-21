import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import Razorpay from 'razorpay'
import { createClient } from '@/lib/supabase/server'
import { withErrorHandler, apiError } from '@/lib/errors'
import { currentGymPrice, computePrice, SUBSCRIPTION_PRICE_PAISE } from '@/lib/pricing/calc'
import type { GymPriceWindow } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

const CreateOrderSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ENTRY'),
    gym_id: z.string().uuid().optional(),
    public_code: z.string().optional(),
  }).refine((d) => d.gym_id || d.public_code, {
    message: 'Either gym_id or public_code is required for ENTRY orders',
  }),
  z.object({
    type: z.literal('SUBSCRIPTION'),
  }),
])

/**
 * POST /api/v1/orders
 * Creates a Razorpay order and an internal order record.
 * Requires authentication.
 */
export const POST = withErrorHandler(async (req: Request) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw apiError('AUTH_REQUIRED', 'Authentication required', 401)

  // Verify complete profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, photo_path, role')
    .eq('id', user.id)
    .single()

  if (!profile) throw apiError('AUTH_REQUIRED', 'Profile not found', 401)
  if (!profile.display_name || !profile.photo_path) {
    throw apiError('PROFILE_INCOMPLETE', 'Please complete your profile before checking in', 400)
  }

  const body = await req.json()
  const parsed = CreateOrderSchema.safeParse(body)
  if (!parsed.success) {
    throw apiError('VALIDATION_ERROR', 'Invalid request body', 400, {
      issues: parsed.error.issues,
    })
  }
  const input = parsed.data

  // Check if user has active subscription (for fee discount)
  const { data: activeSub } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  const is_subscriber = !!activeSub

  let gym_id: string | null = null
  let gym_price_paise: number
  let orderType: 'ENTRY' | 'SUBSCRIPTION'

  if (input.type === 'SUBSCRIPTION') {
    // Check no existing active subscription
    if (is_subscriber) {
      throw apiError('ALREADY_SUBSCRIBED', 'You already have an active Crux Pass Plus subscription', 409)
    }
    orderType = 'SUBSCRIPTION'
    gym_price_paise = SUBSCRIPTION_PRICE_PAISE
  } else {
    orderType = 'ENTRY'

    // Resolve gym
    let gymQuery = supabase.from('gyms').select('*')
    if (input.gym_id) {
      gymQuery = gymQuery.eq('id', input.gym_id)
    } else {
      gymQuery = gymQuery.eq('public_code', input.public_code!)
    }
    const { data: gym, error: gymError } = await gymQuery.single()
    if (gymError || !gym) throw apiError('NOT_FOUND', 'Gym not found', 404)
    if (gym.is_paused) throw apiError('GYM_PAUSED', 'This gym is not currently accepting check-ins', 409)

    gym_id = gym.id

    // Check single active check-in constraint
    const { data: existingCheckin } = await supabase
      .from('checkins')
      .select('id, gym_id')
      .eq('user_id', user.id)
      .eq('status', 'PENDING')
      .maybeSingle()
    if (existingCheckin) {
      throw apiError(
        'ACTIVE_CHECKIN',
        'You already have an active check-in in progress. Please complete or wait for it to expire.',
        409
      )
    }

    // Check daily cap
    const { data: capRow } = await supabase
      .from('gym_caps')
      .select('daily_cap')
      .eq('gym_id', gym_id)
      .maybeSingle()

    if (capRow?.daily_cap) {
      const { data: countData } = await supabase.rpc('count_gym_checkins_today', {
        p_gym_id: gym_id,
      })
      if (typeof countData === 'number' && countData >= capRow.daily_cap) {
        throw apiError('GYM_FULL', 'This gym has reached its daily capacity', 409)
      }
    }

    // Compute current price
    const { data: windows } = await supabase
      .from('gym_price_windows')
      .select('*')
      .eq('gym_id', gym_id)

    const priceWindows = (windows ?? []) as GymPriceWindow[]
    gym_price_paise = currentGymPrice(gym.base_price_paise, priceWindows)
  }

  const breakdown = computePrice(gym_price_paise, input.type === 'ENTRY' ? is_subscriber : false)

  // Create internal order record
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      type: orderType,
      user_id: user.id,
      gym_id,
      platform_fee_bps: breakdown.platform_fee_bps,
      gst_rate_bps: breakdown.gst_rate_bps,
      gym_price_paise: breakdown.gym_price_paise,
      platform_fee_paise: breakdown.platform_fee_paise,
      gst_paise: breakdown.gst_paise,
      total_paise: breakdown.total_paise,
      status: 'CREATED',
    })
    .select('id')
    .single()

  if (orderError || !order) {
    throw apiError('DB_ERROR', 'Failed to create order', 500)
  }

  // Create Razorpay order
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rzOrder: any
  try {
    rzOrder = await razorpay.orders.create({
      amount: breakdown.total_paise,
      currency: 'INR',
      receipt: order.id,
    })
  } catch (err) {
    // Roll back internal order on gateway failure
    await supabase.from('orders').delete().eq('id', order.id)
    console.error('[Razorpay] Order creation failed', err)
    throw apiError('PAYMENT_GATEWAY_ERROR', 'Failed to initiate payment. Please try again.', 502)
  }

  // Store the Razorpay order ID in payments table
  await supabase.from('payments').insert({
    order_id: order.id,
    provider: 'RAZORPAY',
    provider_order_id: rzOrder.id,
    status: 'CREATED',
  })

  return NextResponse.json({
    order_id: order.id,
    razorpay_order_id: rzOrder.id,
    amount_paise: breakdown.total_paise,
    currency: 'INR',
    key_id: process.env.RAZORPAY_KEY_ID,
    breakdown,
  })
})
