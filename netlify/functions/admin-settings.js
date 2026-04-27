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

export const handler = withErrorHandling(async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS }
  }

  try {
    requireSuperadmin(event)
  } catch (err) {
    return json(err.status || 401, { error: err.message })
  }

  if (event.httpMethod !== 'PATCH') {
    return json(405, { error: 'Method not allowed' })
  }

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch (_) {
    return json(400, { error: 'Invalid JSON' })
  }

  const supabase = getSupabase()
  const results = {}

  const allowed = ['maintenance_mode']
  for (const key of allowed) {
    if (body[key] === undefined) continue
    const value = String(body[key])
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    if (error) return json(500, { error: error.message })
    results[key] = body[key]
  }

  if (Object.keys(results).length === 0) {
    return json(400, { error: 'No valid settings provided' })
  }

  return json(200, results)
})
