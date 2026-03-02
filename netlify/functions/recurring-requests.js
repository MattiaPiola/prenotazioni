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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch (_) {
    return { statusCode: 400, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const { room_id, room_slot_id, start_date, end_date, weekdays, teacher_name, class_name } = body

  if (!room_id || !room_slot_id || !start_date || !end_date || !weekdays || !teacher_name || !class_name) {
    return {
      statusCode: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing required fields' }),
    }
  }

  if (!Array.isArray(weekdays) || weekdays.length === 0) {
    return {
      statusCode: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'weekdays must be a non-empty array' }),
    }
  }

  const validDays = weekdays.every((d) => Number.isInteger(d) && d >= 1 && d <= 7)
  if (!validDays) {
    return {
      statusCode: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'weekdays must contain values 1-7 (Mon=1, Sun=7)' }),
    }
  }

  const start = new Date(start_date)
  const end = new Date(end_date)
  if (end < start) {
    return {
      statusCode: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'end_date must be after start_date' }),
    }
  }

  const diffDays = (end - start) / (1000 * 60 * 60 * 24)
  if (diffDays > 365) {
    return {
      statusCode: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Date range cannot exceed 365 days' }),
    }
  }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('recurring_requests')
    .insert({
      room_id,
      room_slot_id,
      start_date,
      end_date,
      weekdays,
      teacher_name: teacher_name.trim(),
      class_name: class_name.trim(),
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    return {
      statusCode: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message }),
    }
  }

  return {
    statusCode: 201,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }
})
