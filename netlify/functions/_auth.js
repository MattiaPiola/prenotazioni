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

// Returns { is_superadmin, admin_user_id }
// Old sessions (no is_superadmin field) are treated as superadmin for backward compatibility.
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
  const is_superadmin = payload.is_superadmin !== false
  return {
    is_superadmin,
    admin_user_id: payload.admin_user_id || null,
  }
}

// Throws 403 if the session is not superadmin.
export function requireSuperadmin(event) {
  const ctx = requireAdmin(event)
  if (!ctx.is_superadmin) {
    const err = new Error('Forbidden')
    err.status = 403
    throw err
  }
  return ctx
}

// Checks that the admin has access to the given roomId.
// Superadmins always pass. Room-admins must have a matching admin_room_permissions row.
export async function requireRoomAccess(ctx, roomId, supabase) {
  if (ctx.is_superadmin) return ctx
  const { data, error } = await supabase
    .from('admin_room_permissions')
    .select('room_id')
    .eq('admin_user_id', ctx.admin_user_id)
    .eq('room_id', roomId)
    .single()
  if (error || !data) {
    const err = new Error('Forbidden')
    err.status = 403
    throw err
  }
  return ctx
}

// Returns null for superadmin (meaning all rooms), or an array of permitted room IDs for room-admins.
export async function getPermittedRoomIds(ctx, supabase) {
  if (ctx.is_superadmin) return null
  const { data, error } = await supabase
    .from('admin_room_permissions')
    .select('room_id')
    .eq('admin_user_id', ctx.admin_user_id)
  if (error) return []
  return (data || []).map((r) => r.room_id)
}

export function setSessionCookie(payload) {
  const secret = process.env.SESSION_SIGNING_SECRET || 'dev-secret'
  const token = signSession(payload, secret)
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`
}
