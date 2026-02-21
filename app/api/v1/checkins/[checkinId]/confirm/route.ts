import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { withErrorHandler, apiError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

const ConfirmSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  reject_reason: z.string().optional(),
})

/**
 * POST /api/v1/checkins/:checkinId/confirm
 * Gym staff approves or rejects a PENDING check-in.
 * Requires gym_staff or gym_admin role for the check-in's gym.
 */
export const POST = withErrorHandler(async (req: Request, ctx: unknown) => {
  const { params } = ctx as { params: Promise<{ checkinId: string }> }
  const { checkinId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw apiError('AUTH_REQUIRED', 'Authentication required', 401)

  const body = await req.json()
  const parsed = ConfirmSchema.safeParse(body)
  if (!parsed.success) {
    throw apiError('VALIDATION_ERROR', 'Invalid request body', 400, {
      issues: parsed.error.issues,
    })
  }
  const { action, reject_reason } = parsed.data

  // Fetch checkin
  const { data: checkin } = await supabase
    .from('checkins')
    .select('id, gym_id, status, expires_at')
    .eq('id', checkinId)
    .single()

  if (!checkin) throw apiError('NOT_FOUND', 'Check-in not found', 404)
  if (checkin.status !== 'PENDING') {
    throw apiError('CHECKIN_NOT_PENDING', 'Check-in is no longer pending', 409)
  }
  if (new Date(checkin.expires_at) < new Date()) {
    throw apiError('CHECKIN_EXPIRED', 'This check-in token has expired', 409)
  }

  // Verify the user is staff/admin for this gym
  const { data: gymUser } = await supabase
    .from('gym_users')
    .select('gym_role')
    .eq('user_id', user.id)
    .eq('gym_id', checkin.gym_id)
    .single()

  if (!gymUser) {
    throw apiError('FORBIDDEN', 'You are not a staff member at this gym', 403)
  }

  const svc = await createServiceClient()
  const now = new Date().toISOString()

  if (action === 'APPROVE') {
    await svc
      .from('checkins')
      .update({ status: 'APPROVED', approved_at: now })
      .eq('id', checkinId)
    return NextResponse.json({ success: true, status: 'APPROVED' })
  } else {
    await svc
      .from('checkins')
      .update({ status: 'REJECTED', rejected_at: now, reject_reason: reject_reason ?? null })
      .eq('id', checkinId)
    return NextResponse.json({ success: true, status: 'REJECTED' })
  }
})
