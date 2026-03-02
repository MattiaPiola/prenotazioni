import { getSupabase } from './_supabase.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS }
  }

  // Extract roomId from path: /api/rooms/:id/bookings
  const match = event.path.match(/rooms\/([^/]+)\/bookings/)
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

  if (!date_from || !date_to) {
    return {
      statusCode: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'date_from and date_to are required' }),
    }
  }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('room_id', roomId)
    .gte('date', date_from)
    .lte('date', date_to)
    .order('date')
    .order('room_slot_id')

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
}
