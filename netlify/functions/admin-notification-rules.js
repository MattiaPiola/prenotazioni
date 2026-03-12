import { getSupabase } from './_supabase.js'
import { requireSuperadmin } from './_auth.js'
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

const VALID_EVENT_TYPES = [
  'booking_created',
  'recurring_request_created',
  'recurring_request_approved',
  'recurring_request_denied',
  'booking_cancelled',
]

const VALID_SCOPES = ['all_rooms', 'specific_rooms']

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

  // PATCH /api/admin/notification-rules/:id
  // DELETE /api/admin/notification-rules/:id
  const idMatch = path.match(/notification-rules\/([^/]+)$/)
  const ruleId = idMatch ? idMatch[1] : null

  if (method === 'GET') {
    const { data, error } = await supabase
      .from('notification_rules')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return json(500, { error: error.message })
    return json(200, data)
  }

  if (method === 'POST') {
    let body
    try { body = JSON.parse(event.body || '{}') } catch (_) { return json(400, { error: 'Invalid JSON' }) }

    const { enabled = true, event_type, scope, room_ids = null, telegram_chat_id } = body

    if (!event_type || !VALID_EVENT_TYPES.includes(event_type)) {
      return json(400, { error: `event_type must be one of: ${VALID_EVENT_TYPES.join(', ')}` })
    }
    if (!scope || !VALID_SCOPES.includes(scope)) {
      return json(400, { error: `scope must be one of: ${VALID_SCOPES.join(', ')}` })
    }
    if (!telegram_chat_id || !telegram_chat_id.toString().trim()) {
      return json(400, { error: 'telegram_chat_id is required' })
    }
    if (scope === 'specific_rooms' && (!Array.isArray(room_ids) || room_ids.length === 0)) {
      return json(400, { error: 'room_ids must be a non-empty array when scope is specific_rooms' })
    }

    const { data, error } = await supabase
      .from('notification_rules')
      .insert({
        enabled: Boolean(enabled),
        event_type,
        scope,
        room_ids: scope === 'specific_rooms' ? room_ids : null,
        telegram_chat_id: telegram_chat_id.toString().trim(),
      })
      .select()
      .single()

    if (error) return json(500, { error: error.message })
    return json(201, data)
  }

  if (method === 'PATCH' && ruleId) {
    let body
    try { body = JSON.parse(event.body || '{}') } catch (_) { return json(400, { error: 'Invalid JSON' }) }

    const updates = {}
    if (body.enabled !== undefined) updates.enabled = Boolean(body.enabled)
    if (body.event_type !== undefined) {
      if (!VALID_EVENT_TYPES.includes(body.event_type)) {
        return json(400, { error: `event_type must be one of: ${VALID_EVENT_TYPES.join(', ')}` })
      }
      updates.event_type = body.event_type
    }
    if (body.scope !== undefined) {
      if (!VALID_SCOPES.includes(body.scope)) {
        return json(400, { error: `scope must be one of: ${VALID_SCOPES.join(', ')}` })
      }
      updates.scope = body.scope
    }
    if (body.room_ids !== undefined) updates.room_ids = body.room_ids
    if (body.telegram_chat_id !== undefined) {
      if (!body.telegram_chat_id.toString().trim()) {
        return json(400, { error: 'telegram_chat_id cannot be empty' })
      }
      updates.telegram_chat_id = body.telegram_chat_id.toString().trim()
    }

    // Validate scope + room_ids consistency
    const finalScope = updates.scope
    const finalRoomIds = updates.room_ids
    if (finalScope === 'specific_rooms') {
      // room_ids must be provided (and non-empty) when changing scope to specific_rooms
      if (finalRoomIds === undefined) {
        return json(400, { error: 'room_ids is required when setting scope to specific_rooms' })
      }
      if (!Array.isArray(finalRoomIds) || finalRoomIds.length === 0) {
        return json(400, { error: 'room_ids must be a non-empty array when scope is specific_rooms' })
      }
    }
    if (finalScope === 'all_rooms') {
      updates.room_ids = null
    }

    if (Object.keys(updates).length === 0) return json(400, { error: 'No fields to update' })

    const { data, error } = await supabase
      .from('notification_rules')
      .update(updates)
      .eq('id', ruleId)
      .select()
      .single()

    if (error) return json(500, { error: error.message })
    if (!data) return json(404, { error: 'Rule not found' })
    return json(200, data)
  }

  if (method === 'DELETE' && ruleId) {
    const { error } = await supabase.from('notification_rules').delete().eq('id', ruleId)
    if (error) return json(500, { error: error.message })
    return json(204, {})
  }

  return json(405, { error: 'Method not allowed' })
})
