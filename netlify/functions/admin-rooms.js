import { getSupabase } from './_supabase.js'
import { requireAdmin, getPermittedRoomIds } from './_auth.js'
import { withErrorHandling } from './_handler.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true',
}

function json(statusCode, body, extra = {}) {
  return {
    statusCode,
    headers: { ...CORS, 'Content-Type': 'application/json', ...extra },
    body: JSON.stringify(body),
  }
}

export const handler = withErrorHandling(async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS }
  }

  let ctx
  try {
    ctx = requireAdmin(event)
  } catch (err) {
    return json(err.status || 401, { error: err.message })
  }

  const supabase = getSupabase()
  const method = event.httpMethod

  // Detect duplicate action: /api/admin/rooms/:id/duplicate — superadmin only
  const duplicateMatch = event.path.match(/admin\/rooms\/([^/]+)\/duplicate$/)
  if (duplicateMatch && method === 'POST') {
    if (!ctx.is_superadmin) return json(403, { error: 'Forbidden' })
    const srcId = duplicateMatch[1]
    // Fetch source room
    const { data: src, error: srcErr } = await supabase.from('rooms').select('*').eq('id', srcId).single()
    if (srcErr || !src) return json(404, { error: 'Room not found' })
    // Create new room with "(Copia)" suffix
    const { data: newRoom, error: newErr } = await supabase
      .from('rooms')
      .insert({
        name: `${src.name} (Copia)`,
        announcement: src.announcement || null,
        allow_user_edit: src.allow_user_edit,
        visible_weekdays: src.visible_weekdays,
        emoji: src.emoji || null,
      })
      .select()
      .single()
    if (newErr) return json(500, { error: newErr.message })
    // Copy slots
    const { data: slots } = await supabase.from('room_slots').select('*').eq('room_id', srcId).order('sort_order')
    if (slots && slots.length > 0) {
      const newSlots = slots.map(({ id: _id, room_id: _rid, created_at: _ca, ...rest }) => ({
        ...rest,
        room_id: newRoom.id,
      }))
      await supabase.from('room_slots').insert(newSlots)
    }
    return json(201, newRoom)
  }

  // Extract optional room id from path: /api/admin/rooms/:id
  const match = event.path.match(/admin\/rooms\/([^/]+)$/)
  const roomId = match ? match[1] : null

  if (method === 'GET') {
    const permittedRoomIds = await getPermittedRoomIds(ctx, supabase)
    if (permittedRoomIds !== null && permittedRoomIds.length === 0) {
      return json(200, [])
    }
    let query = supabase.from('rooms').select('*').order('name')
    if (permittedRoomIds !== null) {
      query = query.in('id', permittedRoomIds)
    }
    const { data, error } = await query
    if (error) return json(500, { error: error.message })
    return json(200, data)
  }

  if (method === 'POST') {
    if (!ctx.is_superadmin) return json(403, { error: 'Forbidden' })
    let body
    try { body = JSON.parse(event.body || '{}') } catch (_) { return json(400, { error: 'Invalid JSON' }) }
    const { name } = body
    if (!name) return json(400, { error: 'name is required' })
    const { data, error } = await supabase.from('rooms').insert({ name: name.trim() }).select().single()
    if (error) return json(500, { error: error.message })
    return json(201, data)
  }

  if (method === 'PATCH') {
    if (!ctx.is_superadmin) return json(403, { error: 'Forbidden' })
    if (!roomId) return json(400, { error: 'Room id required' })
    let body
    try { body = JSON.parse(event.body || '{}') } catch (_) { return json(400, { error: 'Invalid JSON' }) }
    const updates = {}
    if (body.name !== undefined) updates.name = body.name.trim()
    if (body.announcement !== undefined) updates.announcement = body.announcement || null
    if (body.allow_user_edit !== undefined) updates.allow_user_edit = Boolean(body.allow_user_edit)
    if (body.visible_weekdays !== undefined) updates.visible_weekdays = body.visible_weekdays
    if (body.emoji !== undefined) updates.emoji = body.emoji || null
    if (Object.keys(updates).length === 0) return json(400, { error: 'No fields to update' })
    const { data, error } = await supabase.from('rooms').update(updates).eq('id', roomId).select().single()
    if (error) return json(500, { error: error.message })
    return json(200, data)
  }

  if (method === 'DELETE') {
    if (!ctx.is_superadmin) return json(403, { error: 'Forbidden' })
    if (!roomId) return json(400, { error: 'Room id required' })
    const { error } = await supabase.from('rooms').delete().eq('id', roomId)
    if (error) return json(500, { error: error.message })
    return json(204, {})
  }

  return json(405, { error: 'Method not allowed' })
})
