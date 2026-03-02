import { getSupabase } from './_supabase.js'
import { withErrorHandling } from './_handler.js'

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

function jsonResp(statusCode, body) {
  return { statusCode, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

export const handler = withErrorHandling(async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS }
  }

  const supabase = getSupabase()
  const method = event.httpMethod

  // DELETE /api/bookings/:id — user cancellation (only allowed if room has allow_user_edit=true)
  const deleteMatch = event.path.match(/bookings\/([^/]+)$/)
  if (deleteMatch && method === 'DELETE') {
    const id = deleteMatch[1]
    // Fetch booking to get room_id
    const { data: booking, error: fetchErr } = await supabase.from('bookings').select('room_id').eq('id', id).single()
    if (fetchErr || !booking) return jsonResp(404, { error: 'Booking not found' })
    // Check room allows user edits
    const { data: room } = await supabase.from('rooms').select('allow_user_edit').eq('id', booking.room_id).single()
    if (!room || !room.allow_user_edit) return jsonResp(403, { error: 'La cancellazione non è consentita per questa aula.' })
    const { error } = await supabase.from('bookings').delete().eq('id', id)
    if (error) return jsonResp(500, { error: error.message })
    return jsonResp(204, {})
  }

  if (method !== 'POST') {
    return jsonResp(405, { error: 'Method not allowed' })
  }

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch (_) {
    return jsonResp(400, { error: 'Invalid JSON' })
  }

  const { room_id, room_slot_id, date, teacher_name, class_name } = body

  if (!room_id || !room_slot_id || !date || !teacher_name || !class_name) {
    return jsonResp(400, { error: 'Missing required fields: room_id, room_slot_id, date, teacher_name, class_name' })
  }

  // Validate date is within current or next week
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const currentMonday = getMonday(today)
  const nextSunday = new Date(currentMonday)
  nextSunday.setDate(currentMonday.getDate() + 13) // 2 weeks - 1 day

  const bookingDate = new Date(date + 'T00:00:00')
  if (bookingDate < currentMonday || bookingDate > nextSunday) {
    return jsonResp(400, { error: 'La data deve essere nella settimana corrente o in quella successiva.' })
  }

  // Check if slot is blocked
  const { data: blocked } = await supabase
    .from('blocked_slots')
    .select('id')
    .eq('room_id', room_id)
    .eq('room_slot_id', room_slot_id)
    .eq('date', date)
    .maybeSingle()
  if (blocked) return jsonResp(409, { error: 'Questo slot è bloccato per la data selezionata.' })

  // Check max_bookings for the slot
  const { data: slot } = await supabase.from('room_slots').select('max_bookings').eq('id', room_slot_id).single()
  const maxBookings = slot ? (slot.max_bookings || 1) : 1
  const { count } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', room_id)
    .eq('room_slot_id', room_slot_id)
    .eq('date', date)
  if ((count || 0) >= maxBookings) {
    return jsonResp(409, { error: 'Questo slot è esaurito per la data selezionata.' })
  }

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
    return jsonResp(500, { error: error.message })
  }

  return jsonResp(201, data)
})

