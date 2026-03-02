import { createClient } from '@supabase/supabase-js'

export function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    const err = new Error(
      'Supabase environment variables are not configured. ' +
      'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the Netlify project settings ' +
      '(Settings → Environment variables) and make sure they are available to deploy previews.'
    )
    err.status = 503
    throw err
  }
  return createClient(url, key)
}
