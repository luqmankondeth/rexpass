import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withErrorHandler, apiError } from '@/lib/errors'
import { currentGymPrice, computePrice } from '@/lib/pricing/calc'
import type { GymPriceWindow, Subscription } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/gyms/:gymId
 * Returns gym detail, current price, and user's price breakdown (with subscriber discount if applicable).
 * Public — no auth required (subscriber check is optional).
 */
export const GET = withErrorHandler(async (req: Request, ctx: unknown) => {
  const { params } = ctx as { params: Promise<{ gymId: string }> }
  const { gymId } = await params

  const supabase = await createClient()

  // Fetch gym
  const { data: gym, error: gymError } = await supabase
    .from('gyms')
    .select('*')
    .eq('id', gymId)
    .single()

  if (gymError || !gym) throw apiError('NOT_FOUND', 'Gym not found', 404)

  // Fetch price windows
  const { data: windows } = await supabase
    .from('gym_price_windows')
    .select('*')
    .eq('gym_id', gymId)

  const priceWindows = (windows ?? []) as GymPriceWindow[]
  const current_price_paise = currentGymPrice(gym.base_price_paise, priceWindows)

  // Check if requester has an active subscription (best-effort, no auth error)
  let is_subscriber = false
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('id, expires_at')
      .eq('user_id', user.id)
      .eq('status', 'ACTIVE')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()
    is_subscriber = !!sub
  }

  const breakdown = computePrice(current_price_paise, is_subscriber)

  // Fetch daily cap info
  const { data: capRow } = await supabase
    .from('gym_caps')
    .select('daily_cap')
    .eq('gym_id', gymId)
    .maybeSingle()

  return NextResponse.json({
    ...gym,
    price_windows: priceWindows,
    current_price_paise,
    is_subscriber,
    price_breakdown: breakdown,
    daily_cap: capRow?.daily_cap ?? null,
  })
})
