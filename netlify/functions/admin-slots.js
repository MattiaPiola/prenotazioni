import { getSupabase } from './_supabase.js'
import { requireAdmin } from './_auth.js'

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

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS }
  }

  try {
    requireAdmin(event)
  } catch (err) {
    return json(err.status || 401, { error: err.message })
  }

  const supabase = getSupabase()
  const method = event.httpMethod
  const path = event.path

  // Path patterns:
  // /api/admin/rooms/:roomId/slots         → GET/POST
  // /api/admin/rooms/:roomId/slots/:slotId → PATCH/DELETE
  const slotMatch = path.match(/rooms\/([^/]+)\/slots\/([^/]+)$/)
  const baseMatch = path.match(/rooms\/([^/]+)\/slots$/)

  const roomId = slotMatch ? slotMatch[1] : baseMatch ? baseMatch[1] : null
  const slotId = slotMatch ? slotMatch[2] : null

  if (!roomId) return json(400, { error: 'Room id required in path' })

  if (method === 'GET') {
    const { data, error } = await supabase
      .from('room_slots')
      .select('*')
      .eq('room_id', roomId)
      .order('sort_order')
      .order('start_time')
    if (error) return json(500, { error: error.message })
    return json(200, data)
  }

  if (method === 'POST') {
    let body
    try { body = JSON.parse(event.body || '{}') } catch (_) { return json(400, { error: 'Invalid JSON' }) }
    const { start_time, end_time, label, sort_order } = body
    if (!start_time || !end_time) return json(400, { error: 'start_time and end_time are required' })
    const { data, error } = await supabase
      .from('room_slots')
      .insert({ room_id: roomId, start_time, end_time, label: label || null, sort_order: sort_order || 0 })
      .select()
      .single()
    if (error) return json(500, { error: error.message })
    return json(201, data)
  }

  if (method === 'PATCH') {
    if (!slotId) return json(400, { error: 'Slot id required' })
    let body
    try { body = JSON.parse(event.body || '{}') } catch (_) { return json(400, { error: 'Invalid JSON' }) }
    const updates = {}
    if (body.start_time !== undefined) updates.start_time = body.start_time
    if (body.end_time !== undefined) updates.end_time = body.end_time
    if (body.label !== undefined) updates.label = body.label || null
    if (body.sort_order !== undefined) updates.sort_order = parseInt(body.sort_order, 10) || 0
    const { data, error } = await supabase
      .from('room_slots')
      .update(updates)
      .eq('id', slotId)
      .eq('room_id', roomId)
      .select()
      .single()
    if (error) return json(500, { error: error.message })
    return json(200, data)
  }

  if (method === 'DELETE') {
    if (!slotId) return json(400, { error: 'Slot id required' })
    const { error } = await supabase
      .from('room_slots')
      .delete()
      .eq('id', slotId)
      .eq('room_id', roomId)
    if (error) return json(500, { error: error.message })
    return json(204, {})
  }

  return json(405, { error: 'Method not allowed' })
}
