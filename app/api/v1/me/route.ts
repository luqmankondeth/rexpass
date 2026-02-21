import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError, withErrorHandler } from '@/lib/errors'

export const GET = withErrorHandler(async () => {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw apiError('AUTH_REQUIRED', 'Authentication required', 401)
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, display_name, phone, photo_path, role, created_at, updated_at')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    throw apiError('NOT_FOUND', 'Profile not found', 404)
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email ?? null,
      phone: user.phone ?? null,
    },
    profile,
  })
})
