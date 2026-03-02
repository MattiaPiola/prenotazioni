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

  // Extract roomId from path: /api/rooms/:id/slots
  const match = event.path.match(/rooms\/([^/]+)\/slots/)
  const roomId = match ? match[1] : null

  if (!roomId) {
    return {
      statusCode: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing room id' }),
    }
  }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('room_slots')
    .select('*')
    .eq('room_id', roomId)
    .order('sort_order')
    .order('start_time')

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
