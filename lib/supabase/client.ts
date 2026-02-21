import { createBrowserClient } from '@supabase/ssr'

// Database generic type will be added after running: npx supabase gen types typescript --local
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
