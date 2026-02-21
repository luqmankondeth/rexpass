import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withErrorHandler, apiError } from '@/lib/errors'
import { currentGymPrice } from '@/lib/pricing/calc'
import type { GymNearResult, GymPriceWindow } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/gyms
 * Query params: lat, lng, radius_km (default 50), city (fallback)
 * Public — no auth required.
 */
export const GET = withErrorHandler(async (req: Request) => {
  const url = new URL((req as NextRequest).url)
  const latParam = url.searchParams.get('lat')
  const lngParam = url.searchParams.get('lng')
  const radiusKm = parseFloat(url.searchParams.get('radius_km') ?? '50')
  const city = url.searchParams.get('city')

  const supabase = await createClient()

  let gyms: GymNearResult[] = []

  if (latParam && lngParam) {
    const lat = parseFloat(latParam)
    const lng = parseFloat(lngParam)

    if (isNaN(lat) || isNaN(lng)) {
      throw apiError('INVALID_PARAMS', 'lat and lng must be valid numbers', 400)
    }

    const { data, error } = await supabase.rpc('get_gyms_near', {
      user_lat: lat,
      user_lng: lng,
      radius_km: radiusKm,
      max_results: 50,
    })
    if (error) throw apiError('DB_ERROR', error.message, 500)
    gyms = (data ?? []) as GymNearResult[]
  } else if (city) {
    const { data, error } = await supabase
      .from('gyms')
      .select('*')
      .eq('is_paused', false)
      .ilike('city', `%${city}%`)
      .order('created_at')
    if (error) throw apiError('DB_ERROR', error.message, 500)
    gyms = (data ?? []).map((g) => ({ ...g, distance_km: null })) as unknown as GymNearResult[]
  } else {
    // Default: return all active gyms (paginated to 20)
    const { data, error } = await supabase
      .from('gyms')
      .select('*')
      .eq('is_paused', false)
      .order('name')
      .limit(20)
    if (error) throw apiError('DB_ERROR', error.message, 500)
    gyms = (data ?? []).map((g) => ({ ...g, distance_km: null })) as unknown as GymNearResult[]
  }

  // Attach current effective price to each gym
  const gymIds = gyms.map((g) => g.id)
  let windowsByGym: Record<string, GymPriceWindow[]> = {}

  if (gymIds.length > 0) {
    const { data: windows } = await supabase
      .from('gym_price_windows')
      .select('*')
      .in('gym_id', gymIds)
    if (windows) {
      for (const w of windows as GymPriceWindow[]) {
        if (!windowsByGym[w.gym_id]) windowsByGym[w.gym_id] = []
        windowsByGym[w.gym_id].push(w)
      }
    }
  }

  const result = gyms.map((gym) => ({
    ...gym,
    current_price_paise: currentGymPrice(gym.base_price_paise, windowsByGym[gym.id] ?? []),
  }))

  return NextResponse.json(result)
})
