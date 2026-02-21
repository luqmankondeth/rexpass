import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withErrorHandler, apiError } from '@/lib/errors'
import { SUBSCRIPTION_PRICE_PAISE, computePrice, formatINR } from '@/lib/pricing/calc'

export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/subscriptions
 * Returns the user's current subscription status and pricing info.
 * Requires authentication.
 */
export const GET = withErrorHandler(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw apiError('AUTH_REQUIRED', 'Authentication required', 401)

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id, status, starts_at, expires_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const is_active = sub?.status === 'ACTIVE' && sub.expires_at > new Date().toISOString()

  // Price breakdown for the subscription purchase
  const breakdown = computePrice(SUBSCRIPTION_PRICE_PAISE, false)

  return NextResponse.json({
    is_active,
    subscription: sub ?? null,
    purchase_price_paise: breakdown.total_paise,
    purchase_price_display: formatINR(breakdown.total_paise),
    breakdown,
    benefit: 'Platform fee reduced from 10% to 5% on every gym visit',
  })
})
