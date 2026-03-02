import { getSupabase } from './_supabase.js'
import { withErrorHandling } from './_handler.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export const handler = withErrorHandling(async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS }
  }

  // Extract roomId from path: /api/rooms/:id/blocked-slots
  const match = event.path.match(/rooms\/([^/]+)\/blocked-slots/)
  const roomId = match ? match[1] : null

  if (!roomId) {
    return {
      statusCode: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing room id' }),
    }
  }

  const params = event.queryStringParameters || {}
  const { date_from, date_to } = params

  const supabase = getSupabase()
  let query = supabase.from('blocked_slots').select('*').eq('room_id', roomId)
  if (date_from) query = query.gte('date', date_from)
  if (date_to) query = query.lte('date', date_to)

  const { data, error } = await query

  if (error) {
    return {
      statusCode: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message }),
    }
  }

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }
})
