import { getSupabase } from './_supabase.js'
import { withErrorHandling } from './_handler.js'
import { emitEvent } from './_notify.js'

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
    // Fetch booking to get room_id and details for notification
    const { data: booking, error: fetchErr } = await supabase
      .from('bookings')
      .select('room_id, room_slot_id, date, teacher_name, class_name, source')
      .eq('id', id)
      .single()
    if (fetchErr || !booking) return jsonResp(404, { error: 'Booking not found' })
    // Check room allows user edits
    const { data: room } = await supabase.from('rooms').select('allow_user_edit').eq('id', booking.room_id).single()
    if (!room || !room.allow_user_edit) return jsonResp(403, { error: 'La cancellazione non è consentita per questo laboratorio.' })
    // Recurring bookings cannot be cancelled by users
    if (booking.source === 'recurring') return jsonResp(403, { error: 'Le prenotazioni ricorrenti non possono essere cancellate.' })
    // Check if slot is locked
    const { data: lockedSlot } = await supabase
      .from('blocked_slots')
      .select('id')
      .eq('room_id', booking.room_id)
      .eq('room_slot_id', booking.room_slot_id)
      .eq('date', booking.date)
      .eq('type', 'locked')
      .maybeSingle()
    if (lockedSlot) return jsonResp(423, { error: 'Questo slot è bloccato. Impossibile cancellare la prenotazione.' })
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return jsonResp(500, { error: error.message })
    await emitEvent('booking_cancelled', {
      room_id: booking.room_id,
      payload: {
        room_slot_id: booking.room_slot_id,
        date: booking.date,
        teacher_name: booking.teacher_name,
        class_name: booking.class_name,
      },
    })
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

  if (!room_id || !room_slot_id || !date || !teacher_name) {
    return jsonResp(400, { error: 'Missing required fields: room_id, room_slot_id, date, teacher_name' })
  }

  // Validate date is within the room's allowed booking window
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const currentMonday = getMonday(today)

  // Fetch room to get booking_weeks_ahead
  const { data: roomForValidation, error: roomErr } = await supabase
    .from('rooms')
    .select('booking_weeks_ahead')
    .eq('id', room_id)
    .single()
  if (roomErr || !roomForValidation) return jsonResp(400, { error: 'Laboratorio non trovato.' })
  const weeksAhead = roomForValidation.booking_weeks_ahead ?? 1

  const lastAllowedDay = new Date(currentMonday)
  lastAllowedDay.setDate(currentMonday.getDate() + (weeksAhead + 1) * 7 - 1)

  const bookingDate = new Date(date + 'T00:00:00')
  if (bookingDate < currentMonday || bookingDate > lastAllowedDay) {
    return jsonResp(400, { error: 'La data selezionata non rientra nelle settimane disponibili per la prenotazione.' })
  }

  // Check if slot is blocked
  const { data: blocked } = await supabase
    .from('blocked_slots')
    .select('id, type')
    .eq('room_id', room_id)
    .eq('room_slot_id', room_slot_id)
    .eq('date', date)
    .maybeSingle()
  if (blocked) {
    const msg = blocked.type === 'locked'
      ? 'Questo slot è bloccato. Impossibile effettuare prenotazioni.'
      : 'Questo slot non è disponibile per la data selezionata.'
    return jsonResp(409, { error: msg })
  }

  // Check max_bookings for the slot
  const { data: slot } = await supabase.from('room_slots').select('max_bookings').eq('id', room_slot_id).single()
  const maxBookings = slot ? (slot.max_bookings || 1) : 1
  const { count } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', room_id)
    .eq('room_slot_id', room_slot_id)
    .eq('date', date)
    .eq('status', 'active')
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
      class_name: class_name ? class_name.trim() : null,
      source: 'single',
    })
    .select()
    .single()

  if (error) {
    return jsonResp(500, { error: error.message })
  }

  await emitEvent('booking_created', {
    room_id,
    payload: { room_slot_id, date, teacher_name, class_name },
  })

  return jsonResp(201, data)
})

