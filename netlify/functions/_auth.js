import crypto from 'crypto'

const COOKIE_NAME = 'session'

function signSession(payload, secret) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url')
  return `${encoded}.${sig}`
}

function verifySession(token, secret) {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [encoded, sig] = parts
  const expected = crypto.createHmac('sha256', secret).update(encoded).digest('base64url')
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
  } catch (_) {
    return null
  }
}

function getCookies(event) {
  const cookieHeader = event.headers?.cookie || event.headers?.Cookie || ''
  const cookies = {}
  cookieHeader.split(';').forEach((part) => {
    const [k, ...v] = part.trim().split('=')
    if (k) cookies[k.trim()] = decodeURIComponent(v.join('='))
  })
  return cookies
}

export function requireAdmin(event) {
  const cookies = getCookies(event)
  const token = cookies[COOKIE_NAME]
  const secret = process.env.SESSION_SIGNING_SECRET || 'dev-secret'
  const payload = verifySession(token, secret)
  if (!payload || payload.role !== 'admin') {
    const err = new Error('Unauthorized')
    err.status = 401
    throw err
  }
  return true
}

export function setSessionCookie(payload) {
  const secret = process.env.SESSION_SIGNING_SECRET || 'dev-secret'
  const token = signSession(payload, secret)
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`
}
