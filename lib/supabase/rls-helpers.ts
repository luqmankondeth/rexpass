import type { User } from '@supabase/supabase-js'
import type { UserRole, Profile } from './types'
import { apiError } from '@/lib/errors'

/**
 * Fetches the profile for the current session user using the provided supabase client.
 * Returns null if no profile is found.
 */
export async function getProfile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  user: User
): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  return data ?? null
}

/**
 * Asserts that the profile role is one of the allowed roles.
 * Throws a Response (via apiError) with 403 if not satisfied.
 */
export function requireRole(profile: Profile | null, allowedRoles: UserRole[]): Profile {
  if (!profile) {
    throw apiError('AUTH_REQUIRED', 'Authentication required', 401)
  }
  if (!allowedRoles.includes(profile.role)) {
    throw apiError('FORBIDDEN', 'You do not have permission to perform this action', 403)
  }
  return profile
}

/**
 * Asserts that the profile has a complete profile (photo + display_name).
 * Used before allowing check-ins.
 */
export function requireCompleteProfile(profile: Profile | null): Profile {
  if (!profile) {
    throw apiError('AUTH_REQUIRED', 'Authentication required', 401)
  }
  if (!profile.photo_path || !profile.display_name) {
    throw apiError(
      'PROFILE_INCOMPLETE',
      'Please complete your profile (name and photo required) before checking in',
      400
    )
  }
  return profile
}
