import crypto from 'crypto'
import { setSessionCookie } from './_auth.js'
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

  // Check superadmin code first, then admin code
  const superadminHash = process.env.SUPERADMIN_CODE_HASH || ''
  const adminHash = process.env.ADMIN_CODE_HASH || ''

  let role = null
  if (superadminHash && hash === superadminHash) {
    role = 'superadmin'
  } else if (adminHash && hash === adminHash) {
    role = 'admin'
  }

  if (!role) {
    return {
      statusCode: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid access code' }),
    }
  }

  const cookie = setSessionCookie({ role, iat: Date.now() })

  return {
    statusCode: 200,
    headers: {
      ...CORS,
      'Content-Type': 'application/json',
      'Set-Cookie': cookie,
    },
    body: JSON.stringify({ ok: true, role }),
  }
})
