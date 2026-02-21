import { NextResponse, type NextRequest } from 'next/server'
import crypto from 'crypto'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { withErrorHandler, apiError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

const VerifySchema = z.object({
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
})

/**
 * POST /api/v1/orders/:orderId/verify
 * Verifies Razorpay payment signature and creates the check-in record.
 * Requires authentication.
 */
export const POST = withErrorHandler(async (req: Request, ctx: unknown) => {
  const { params } = ctx as { params: Promise<{ orderId: string }> }
  const { orderId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw apiError('AUTH_REQUIRED', 'Authentication required', 401)

  const body = await req.json()
  const parsed = VerifySchema.safeParse(body)
  if (!parsed.success) {
    throw apiError('VALIDATION_ERROR', 'Invalid request body', 400, {
      issues: parsed.error.issues,
    })
  }
  const { razorpay_payment_id, razorpay_signature } = parsed.data

  // Fetch the internal order (ensure it belongs to this user)
  const { data: order } = await supabase
    .from('orders')
    .select('id, type, user_id, gym_id, total_paise, status')
    .eq('id', orderId)
    .eq('user_id', user.id)
    .single()

  if (!order) throw apiError('NOT_FOUND', 'Order not found', 404)
  if (order.status === 'PAID') throw apiError('ALREADY_PAID', 'This order has already been paid', 409)
  if (order.status !== 'CREATED') throw apiError('ORDER_INVALID', 'Order is not in a payable state', 409)

  // Fetch the Razorpay order ID from payments table
  const { data: payment } = await supabase
    .from('payments')
    .select('id, provider_order_id')
    .eq('order_id', orderId)
    .eq('provider', 'RAZORPAY')
    .single()

  if (!payment) throw apiError('NOT_FOUND', 'Payment record not found', 404)

  // Verify HMAC-SHA256 signature
  // Razorpay signature = HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, key_secret)
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(`${payment.provider_order_id}|${razorpay_payment_id}`)
    .digest('hex')

  if (expectedSignature !== razorpay_signature) {
    throw apiError('INVALID_SIGNATURE', 'Payment signature verification failed', 400)
  }

  // Use service client for the write operations to avoid RLS issues
  const svc = await createServiceClient()

  // Update payment record
  await svc
    .from('payments')
    .update({
      provider_payment_id: razorpay_payment_id,
      status: 'CAPTURED',
    })
    .eq('id', payment.id)

  // Mark order as PAID
  await svc.from('orders').update({ status: 'PAID' }).eq('id', orderId)

  if (order.type === 'ENTRY') {
    // Create check-in record (expires in 90 seconds)
    const expiresAt = new Date(Date.now() + 90 * 1000).toISOString()

    const { data: checkin, error: checkinError } = await svc
      .from('checkins')
      .insert({
        user_id: user.id,
        gym_id: order.gym_id,
        order_id: orderId,
        status: 'PENDING',
        expires_at: expiresAt,
      })
      .select('id')
      .single()

    if (checkinError) {
      // Partial unique index violation = already has active checkin
      if (checkinError.code === '23505') {
        throw apiError(
          'ACTIVE_CHECKIN',
          'You already have an active check-in in progress',
          409
        )
      }
      throw apiError('DB_ERROR', 'Failed to create check-in', 500)
    }

    return NextResponse.json({ checkin_id: checkin.id, type: 'ENTRY' })
  }

  if (order.type === 'SUBSCRIPTION') {
    // Create / extend subscription (30 days from now)
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()

    await svc.from('subscriptions').insert({
      user_id: user.id,
      order_id: orderId,
      status: 'ACTIVE',
      starts_at: now.toISOString(),
      expires_at: expiresAt,
    })

    return NextResponse.json({ type: 'SUBSCRIPTION', expires_at: expiresAt })
  }

  throw apiError('INTERNAL_ERROR', 'Unknown order type', 500)
})
