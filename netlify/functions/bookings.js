import { getSupabase } from './_supabase.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function getMonday(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const dow = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dow)
  return d
}

function formatDate(date) {
  return date.toISOString().slice(0, 10)
}

export async function handler(event) {
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

  const { room_id, room_slot_id, date, teacher_name, class_name } = body

  if (!room_id || !room_slot_id || !date || !teacher_name || !class_name) {
    return {
      statusCode: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing required fields: room_id, room_slot_id, date, teacher_name, class_name' }),
    }
  }

  // Validate date is within current or next week
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const currentMonday = getMonday(today)
  const nextSunday = new Date(currentMonday)
  nextSunday.setDate(currentMonday.getDate() + 13) // 2 weeks - 1 day

  const bookingDate = new Date(date + 'T00:00:00')
  if (bookingDate < currentMonday || bookingDate > nextSunday) {
    return {
      statusCode: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'La data deve essere nella settimana corrente o in quella successiva.' }),
    }
  }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      room_id,
      room_slot_id,
      date,
      teacher_name: teacher_name.trim(),
      class_name: class_name.trim(),
      source: 'single',
    })
    .select()
    .single()

  if (error) {
    // Unique constraint violation
    if (error.code === '23505') {
      return {
        statusCode: 409,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Slot already booked for this date.' }),
      }
    }
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
}
