import { getSupabase } from './_supabase.js'
import { requireAdmin, requireRoomAccess, getPermittedRoomIds } from './_auth.js'
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

  let ctx
  try {
    ctx = requireAdmin(event)
  } catch (err) {
    return json(err.status || 401, { error: err.message })
  }

  const supabase = getSupabase()
  const method = event.httpMethod
  const path = event.path

  // DELETE /api/admin/blocked-slots/:id
  const deleteMatch = path.match(/admin\/blocked-slots\/([^/]+)$/)
  if (deleteMatch && method === 'DELETE') {
    const id = deleteMatch[1]
    // For room-admins, verify they have access to the blocked slot's room
    if (!ctx.is_superadmin) {
      const { data: slot } = await supabase.from('blocked_slots').select('room_id').eq('id', id).single()
      if (!slot) return json(404, { error: 'Blocked slot not found' })
      try {
        await requireRoomAccess(ctx, slot.room_id, supabase)
      } catch (err) {
        return json(err.status || 403, { error: err.message })
      }
    }
    const { error } = await supabase.from('blocked_slots').delete().eq('id', id)
    if (error) return json(500, { error: error.message })
    return json(204, {})
  }

  if (method === 'GET') {
    const params = event.queryStringParameters || {}
    const permittedRoomIds = await getPermittedRoomIds(ctx, supabase)
    let query = supabase.from('blocked_slots').select('*').order('date').order('room_slot_id')
    if (params.room_id) {
      if (permittedRoomIds !== null && !permittedRoomIds.includes(params.room_id)) {
        return json(403, { error: 'Forbidden' })
      }
      query = query.eq('room_id', params.room_id)
    } else if (permittedRoomIds !== null) {
      if (permittedRoomIds.length === 0) return json(200, [])
      query = query.in('room_id', permittedRoomIds)
    }
    if (params.date_from) query = query.gte('date', params.date_from)
    if (params.date_to) query = query.lte('date', params.date_to)
    const { data, error } = await query
    if (error) return json(500, { error: error.message })
    return json(200, data)
  }

  if (method === 'POST') {
    let body
    try { body = JSON.parse(event.body || '{}') } catch (_) { return json(400, { error: 'Invalid JSON' }) }

    // Bulk insert: { room_id, slots: [{ room_slot_id, date, reason? }, ...] }
    if (Array.isArray(body.slots)) {
      const { room_id, slots } = body
      if (!room_id || !slots.length) return json(400, { error: 'room_id and slots are required' })
      try {
        await requireRoomAccess(ctx, room_id, supabase)
      } catch (err) {
        return json(err.status || 403, { error: err.message })
      }
      const records = slots.map(({ room_slot_id, date, reason }) => {
        if (!room_slot_id || !date) return null
        return { room_id, room_slot_id, date, reason: reason || null }
      })
      if (records.some((r) => r === null)) return json(400, { error: 'Each slot requires room_slot_id and date' })
      const { data, error } = await supabase
        .from('blocked_slots')
        .insert(records)
        .select()
      if (error) {
        if (error.code === '23505') return json(409, { error: 'One or more slots already blocked for this date' })
        return json(500, { error: error.message })
      }
      return json(201, data)
    }

    // Single insert
    const { room_id, room_slot_id, date, reason } = body
    if (!room_id || !room_slot_id || !date) return json(400, { error: 'room_id, room_slot_id and date are required' })
    try {
      await requireRoomAccess(ctx, room_id, supabase)
    } catch (err) {
      return json(err.status || 403, { error: err.message })
    }
    const { data, error } = await supabase
      .from('blocked_slots')
      .insert({ room_id, room_slot_id, date, reason: reason || null })
      .select()
      .single()
    if (error) {
      if (error.code === '23505') return json(409, { error: 'Slot already blocked for this date' })
      return json(500, { error: error.message })
    }
    return json(201, data)
  }

  return json(405, { error: 'Method not allowed' })
})
