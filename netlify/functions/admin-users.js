import crypto from 'crypto'
import { requireSuperadmin } from './_auth.js'
import { getSupabase } from './_supabase.js'
import { withErrorHandling } from './_handler.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true',
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

export const handler = withErrorHandling(async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS }
  }

  try {
    requireSuperadmin(event)
  } catch (err) {
    return json(err.status || 401, { error: err.message })
  }

  const supabase = getSupabase()
  const method = event.httpMethod
  const path = event.path

  // POST /api/admin/admin-users/:id/rooms — replace all room permissions for a user
  const roomsMatch = path.match(/admin-users\/([^/]+)\/rooms$/)
  if (roomsMatch && method === 'POST') {
    const id = roomsMatch[1]
    let body
    try { body = JSON.parse(event.body || '{}') } catch (_) { return json(400, { error: 'Invalid JSON' }) }
    const { room_ids } = body
    if (!Array.isArray(room_ids)) return json(400, { error: 'room_ids array required' })

    const { error: delErr } = await supabase
      .from('admin_room_permissions')
      .delete()
      .eq('admin_user_id', id)
    if (delErr) return json(500, { error: delErr.message })

    if (room_ids.length > 0) {
      const records = room_ids.map((room_id) => ({ admin_user_id: id, room_id }))
      const { error: insErr } = await supabase.from('admin_room_permissions').insert(records)
      if (insErr) return json(500, { error: insErr.message })
    }

    return json(200, { ok: true })
  }

  // PATCH/DELETE /api/admin/admin-users/:id
  const idMatch = path.match(/admin-users\/([^/]+)$/)
  const userId = idMatch ? idMatch[1] : null

  if (method === 'GET') {
    const { data, error } = await supabase
      .from('admin_users')
      .select('id, name, active, created_at, admin_room_permissions(room_id, rooms(id, name))')
      .order('created_at')
    if (error) return json(500, { error: error.message })
    return json(200, data)
  }

  if (method === 'POST') {
    let body
    try { body = JSON.parse(event.body || '{}') } catch (_) { return json(400, { error: 'Invalid JSON' }) }
    const { name, code, room_ids } = body
    if (!name || !code) return json(400, { error: 'name and code are required' })
    const code_hash = crypto.createHash('sha256').update(code).digest('hex')
    const { data, error } = await supabase
      .from('admin_users')
      .insert({ name: name.trim(), code_hash, active: true })
      .select()
      .single()
    if (error) return json(500, { error: error.message })
    if (Array.isArray(room_ids) && room_ids.length > 0) {
      const records = room_ids.map((room_id) => ({ admin_user_id: data.id, room_id }))
      await supabase.from('admin_room_permissions').insert(records)
    }
    return json(201, data)
  }

  if (method === 'PATCH') {
    if (!userId) return json(400, { error: 'User id required' })
    let body
    try { body = JSON.parse(event.body || '{}') } catch (_) { return json(400, { error: 'Invalid JSON' }) }
    const updates = {}
    if (body.name !== undefined) updates.name = body.name.trim()
    if (body.active !== undefined) updates.active = Boolean(body.active)
    if (body.code !== undefined && body.code !== '') {
      updates.code_hash = crypto.createHash('sha256').update(body.code).digest('hex')
    }
    if (Object.keys(updates).length === 0) return json(400, { error: 'No fields to update' })
    const { data, error } = await supabase
      .from('admin_users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()
    if (error) return json(500, { error: error.message })
    return json(200, data)
  }

  if (method === 'DELETE') {
    if (!userId) return json(400, { error: 'User id required' })
    const { error } = await supabase.from('admin_users').delete().eq('id', userId)
    if (error) return json(500, { error: error.message })
    return json(204, {})
  }

  return json(405, { error: 'Method not allowed' })
})
