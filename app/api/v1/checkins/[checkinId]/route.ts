import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { withErrorHandler, apiError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/checkins/:checkinId
 * Returns check-in status + gym + user photo for the countdown screen.
 * Requires authentication (only the owner or gym staff can view).
 */
export const GET = withErrorHandler(async (req: Request, ctx: unknown) => {
  const { params } = ctx as { params: Promise<{ checkinId: string }> }
  const { checkinId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw apiError('AUTH_REQUIRED', 'Authentication required', 401)

  const { data: checkin, error } = await supabase
    .from('checkins')
    .select(`
      id, status, expires_at, approved_at, rejected_at, reject_reason, created_at,
      gym:gyms(id, name, address, city),
      profile:profiles!checkins_user_id_fkey(display_name, photo_path)
    `)
    .eq('id', checkinId)
    .single()

  if (error || !checkin) throw apiError('NOT_FOUND', 'Check-in not found', 404)

  // Only the checkin owner can view via this route (gym staff view is Week 3)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profileData = checkin.profile as any
  const profileUserId = await supabase
    .from('checkins')
    .select('user_id')
    .eq('id', checkinId)
    .single()
    .then((r) => r.data?.user_id)

  if (profileUserId !== user.id) {
    throw apiError('FORBIDDEN', 'You do not have permission to view this check-in', 403)
  }

  // Get photo URL if present
  let photo_url: string | null = null
  if (profileData?.photo_path) {
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(profileData.photo_path)
    photo_url = urlData.publicUrl
  }

  return NextResponse.json({
    ...checkin,
    photo_url,
  })
})

/**
 * POST /api/v1/checkins/:checkinId/checkout (manual early checkout — not used by gym staff)
 * Cancels a PENDING check-in. Only the owner can call this.
 */
export const POST = withErrorHandler(async (req: Request, ctx: unknown) => {
  const { params } = ctx as { params: Promise<{ checkinId: string }> }
  const { checkinId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw apiError('AUTH_REQUIRED', 'Authentication required', 401)

  const { data: checkin } = await supabase
    .from('checkins')
    .select('user_id, status')
    .eq('id', checkinId)
    .single()

  if (!checkin) throw apiError('NOT_FOUND', 'Check-in not found', 404)
  if (checkin.user_id !== user.id) {
    throw apiError('FORBIDDEN', 'You do not have permission to modify this check-in', 403)
  }
  if (checkin.status !== 'PENDING') {
    throw apiError('CHECKIN_NOT_PENDING', 'Only pending check-ins can be cancelled', 409)
  }

  const svc = await createServiceClient()
  await svc
    .from('checkins')
    .update({ status: 'CANCELLED' })
    .eq('id', checkinId)

  return NextResponse.json({ success: true })
})
