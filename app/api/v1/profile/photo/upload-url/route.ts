import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { apiError, withErrorHandler } from '@/lib/errors'

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const AVATAR_BUCKET = 'avatars'
const SIGNED_URL_EXPIRY_SECONDS = 300 // 5 minutes to complete the upload

const schema = z.object({
  content_type: z.enum(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] as const),
})

export const POST = withErrorHandler(async (req) => {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw apiError('AUTH_REQUIRED', 'Authentication required', 401)

  const body = await req.json()
  const result = schema.safeParse(body)
  if (!result.success) {
    throw apiError('VALIDATION_ERROR', `content_type must be one of: ${ALLOWED_CONTENT_TYPES.join(', ')}`, 400)
  }

  const ext = result.data.content_type.split('/')[1].replace('jpeg', 'jpg')
  const path = `${user.id}/profile.${ext}`

  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUploadUrl(path, { upsert: true })

  if (error || !data) {
    throw apiError('UPLOAD_URL_FAILED', 'Failed to generate upload URL', 500)
  }

  // After the client uploads, they must call PUT /api/v1/profile with photo_path
  // or we auto-save the path. We'll auto-save here as a convenience.
  await supabase
    .from('profiles')
    .update({ photo_path: path })
    .eq('id', user.id)

  return NextResponse.json({
    upload: {
      bucket: AVATAR_BUCKET,
      path,
      signed_url: data.signedUrl,
      token: data.token,
    },
  })
})
