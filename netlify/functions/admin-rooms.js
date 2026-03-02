import { getSupabase } from './_supabase.js'
import { requireAdmin } from './_auth.js'

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

  // Extract optional room id from path: /api/admin/rooms/:id
  const match = event.path.match(/admin\/rooms\/([^/]+)$/)
  const roomId = match ? match[1] : null

  if (method === 'GET') {
    const { data, error } = await supabase.from('rooms').select('*').order('name')
    if (error) return json(500, { error: error.message })
    return json(200, data)
  }

  if (method === 'POST') {
    let body
    try { body = JSON.parse(event.body || '{}') } catch (_) { return json(400, { error: 'Invalid JSON' }) }
    const { name } = body
    if (!name) return json(400, { error: 'name is required' })
    const { data, error } = await supabase.from('rooms').insert({ name: name.trim() }).select().single()
    if (error) return json(500, { error: error.message })
    return json(201, data)
  }

  if (method === 'PATCH') {
    if (!roomId) return json(400, { error: 'Room id required' })
    let body
    try { body = JSON.parse(event.body || '{}') } catch (_) { return json(400, { error: 'Invalid JSON' }) }
    const { name } = body
    if (!name) return json(400, { error: 'name is required' })
    const { data, error } = await supabase.from('rooms').update({ name: name.trim() }).eq('id', roomId).select().single()
    if (error) return json(500, { error: error.message })
    return json(200, data)
  }

  if (method === 'DELETE') {
    if (!roomId) return json(400, { error: 'Room id required' })
    const { error } = await supabase.from('rooms').delete().eq('id', roomId)
    if (error) return json(500, { error: error.message })
    return json(204, {})
  }

  return json(405, { error: 'Method not allowed' })
}
