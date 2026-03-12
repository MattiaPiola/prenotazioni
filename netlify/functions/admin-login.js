import crypto from 'crypto'
import { setSessionCookie } from './_auth.js'
import { getSupabase } from './_supabase.js'
import { withErrorHandling } from './_handler.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true',
}

export const handler = withErrorHandling(async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch (_) {
    return { statusCode: 400, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const { code } = body
  if (!code) {
    return {
      statusCode: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'code is required' }),
    }
  }

  // Hash the provided code with SHA-256
  const hash = crypto.createHash('sha256').update(code).digest('hex')
  const expectedHash = process.env.ADMIN_CODE_HASH || ''

  // Check superadmin first (supports both ADMIN_CODE_HASH and SUPERADMIN_CODE_HASH env vars)
  const superadminHash = process.env.SUPERADMIN_CODE_HASH || expectedHash
  if (superadminHash && hash === superadminHash) {
    const cookie = setSessionCookie({ role: 'admin', is_superadmin: true, admin_user_id: null, iat: Date.now() })
    return {
      statusCode: 200,
      headers: {
        ...CORS,
        'Content-Type': 'application/json',
        'Set-Cookie': cookie,
      },
      body: JSON.stringify({ ok: true, is_superadmin: true }),
    }
  }

  // Check room-admin accounts in the database
  const supabase = getSupabase()
  if (supabase.statusCode) return supabase // propagate 503 if not configured

  const { data: adminUsers, error: dbError } = await supabase
    .from('admin_users')
    .select('id, name, code_hash')
    .eq('active', true)

  if (dbError) {
    return {
      statusCode: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    }
  }

  // Use timing-safe comparison to prevent hash timing attacks
  const providedHashBuf = Buffer.from(hash, 'hex')
  let matchedUser = null
  for (const u of (adminUsers || [])) {
    const storedHashBuf = Buffer.from(u.code_hash, 'hex')
    if (
      storedHashBuf.length === providedHashBuf.length &&
      crypto.timingSafeEqual(storedHashBuf, providedHashBuf)
    ) {
      if (!matchedUser) matchedUser = u
    }
  }
  if (matchedUser) {
    const cookie = setSessionCookie({ role: 'admin', is_superadmin: false, admin_user_id: matchedUser.id, iat: Date.now() })
    return {
      statusCode: 200,
      headers: {
        ...CORS,
        'Content-Type': 'application/json',
        'Set-Cookie': cookie,
      },
      body: JSON.stringify({ ok: true, is_superadmin: false }),
    }
  }

  return {
    statusCode: 401,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'Invalid access code' }),
  }
})
