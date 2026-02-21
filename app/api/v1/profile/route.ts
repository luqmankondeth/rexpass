import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { apiError, withErrorHandler } from '@/lib/errors'

const updateProfileSchema = z.object({
  display_name: z.string().min(1).max(100),
  phone: z.string().regex(/^\+91[6-9]\d{9}$/, {
    message: 'Phone must be a valid Indian mobile number (+91XXXXXXXXXX)',
  }),
})

export const GET = withErrorHandler(async () => {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw apiError('AUTH_REQUIRED', 'Authentication required', 401)

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error || !profile) throw apiError('NOT_FOUND', 'Profile not found', 404)

  return NextResponse.json({ profile })
})

export const PUT = withErrorHandler(async (req) => {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw apiError('AUTH_REQUIRED', 'Authentication required', 401)

  const body = await req.json()
  const result = updateProfileSchema.safeParse(body)
  if (!result.success) {
    throw apiError('VALIDATION_ERROR', 'Invalid input', 400, {
      issues: result.error.flatten().fieldErrors,
    })
  }

  const { display_name, phone } = result.data

  const { data: profile, error } = await supabase
    .from('profiles')
    .update({ display_name, phone })
    .eq('id', user.id)
    .select('id, display_name, phone, photo_path, role')
    .single()

  if (error) {
    if (error.code === '23505') {
      throw apiError('PHONE_TAKEN', 'This phone number is already linked to another account', 409)
    }
    throw apiError('UPDATE_FAILED', 'Failed to update profile', 500)
  }

  return NextResponse.json({ ok: true, profile })
})
