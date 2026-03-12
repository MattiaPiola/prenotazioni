import { getSupabase } from './_supabase.js'
import { requireAdmin, requireRoomAccess, getPermittedRoomIds } from './_auth.js'
import { withErrorHandling } from './_handler.js'
import { emitEvent } from './_notify.js'

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

function escapeCsv(val) {
  if (val === null || val === undefined) return ''
  const str = String(val)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export const handler = withErrorHandling(async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS }
  }

  let ctx
  try {
    ctx = requireAdmin(event)
  } catch (err) {
    return json(err.status || 401, { error: err.message })
  }

  const supabase = getSupabase()
  const method = event.httpMethod
  const path = event.path

  // PATCH /api/admin/bookings/:id — update booking (teacher_name, class_name)
  const patchMatch = path.match(/admin\/bookings\/([^/]+)$/)
  if (patchMatch && method === 'PATCH') {
    const id = patchMatch[1]
    let body
    try { body = JSON.parse(event.body || '{}') } catch (_) { body = {} }
    const { teacher_name, class_name } = body
    if (!teacher_name || !teacher_name.trim()) return json(400, { error: 'teacher_name is required' })

    const { data: existing } = await supabase.from('bookings').select('room_id').eq('id', id).single()
    if (!existing) return json(404, { error: 'Booking not found' })
    if (!ctx.is_superadmin) {
      try { await requireRoomAccess(ctx, existing.room_id, supabase) } catch (err) {
        return json(err.status || 403, { error: err.message })
      }
    }

    const { data, error } = await supabase
      .from('bookings')
      .update({
        teacher_name: teacher_name.trim(),
        class_name: class_name ? class_name.trim() : null,
        recurring_request_id: null,
      })
      .eq('id', id)
      .select()
      .single()
    if (error) return json(500, { error: error.message })
    return json(200, data)
  }

  // POST /api/admin/bookings — create a single booking (admin, no date restriction)
  if (/admin\/bookings$/.test(path) && method === 'POST') {
    let body
    try { body = JSON.parse(event.body || '{}') } catch (_) { body = {} }
    const { room_id, room_slot_id, date, teacher_name, class_name } = body
    if (!room_id || !room_slot_id || !date || !teacher_name || !teacher_name.trim()) {
      return json(400, { error: 'Campi obbligatori mancanti: room_id, room_slot_id, date, teacher_name' })
    }
    if (!ctx.is_superadmin) {
      try { await requireRoomAccess(ctx, room_id, supabase) } catch (err) {
        return json(err.status || 403, { error: err.message })
      }
    }

    // Check if slot is blocked
    const { data: blocked } = await supabase
      .from('blocked_slots')
      .select('id')
      .eq('room_id', room_id)
      .eq('room_slot_id', room_slot_id)
      .eq('date', date)
      .maybeSingle()
    if (blocked) return json(409, { error: 'Questo slot è bloccato per la data selezionata.' })

    // Check max_bookings
    const { data: slot } = await supabase.from('room_slots').select('max_bookings').eq('id', room_slot_id).single()
    const maxBookings = slot ? (slot.max_bookings || 1) : 1
    const { count } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', room_id)
      .eq('room_slot_id', room_slot_id)
      .eq('date', date)
    if ((count || 0) >= maxBookings) {
      return json(409, { error: 'Questo slot è esaurito per la data selezionata.' })
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
    if (error) return json(500, { error: error.message })
    await emitEvent('booking_created', {
      room_id,
      payload: { room_slot_id, date, teacher_name, class_name },
    })
    return json(201, data)
  }

  // DELETE /api/admin/bookings/:id
  const deleteMatch = path.match(/admin\/bookings\/([^/]+)$/)

  if (deleteMatch && method === 'DELETE') {
    const id = deleteMatch[1]
    // Fetch booking data (for notification emit and room-access check)
    const { data: bookingToCancel } = await supabase
      .from('bookings')
      .select('room_id, room_slot_id, date, teacher_name, class_name')
      .eq('id', id)
      .single()
    if (!bookingToCancel) return json(404, { error: 'Booking not found' })
    // For room-admins, verify they have access to the booking's room
    if (!ctx.is_superadmin) {
      try {
        await requireRoomAccess(ctx, bookingToCancel.room_id, supabase)
      } catch (err) {
        return json(err.status || 403, { error: err.message })
      }
    }
    const { error } = await supabase.from('bookings').delete().eq('id', id)
    if (error) return json(500, { error: error.message })
    if (bookingToCancel) {
      await emitEvent('booking_cancelled', {
        room_id: bookingToCancel.room_id,
        payload: {
          room_slot_id: bookingToCancel.room_slot_id,
          date: bookingToCancel.date,
          teacher_name: bookingToCancel.teacher_name,
          class_name: bookingToCancel.class_name,
        },
      })
    }
    return json(204, {})
  }

  if (method === 'GET') {
    const params = event.queryStringParameters || {}
    const permittedRoomIds = await getPermittedRoomIds(ctx, supabase)

    let query = supabase
      .from('bookings')
      .select('*, rooms(name), room_slots(start_time, end_time)')
      .order('date')
      .order('room_slots(start_time)')

    if (params.from) query = query.gte('date', params.from)
    if (params.to) query = query.lte('date', params.to)

    if (params.room_id) {
      // If room-admin, verify they have permission for the requested room
      if (permittedRoomIds !== null && !permittedRoomIds.includes(params.room_id)) {
        return json(403, { error: 'Forbidden' })
      }
      query = query.eq('room_id', params.room_id)
    } else if (permittedRoomIds !== null) {
      // room-admin: restrict to permitted rooms
      if (permittedRoomIds.length === 0) return json(200, [])
      query = query.in('room_id', permittedRoomIds)
    }

    const { data, error } = await query
    if (error) return json(500, { error: error.message })

    if (params.format === 'csv') {
      const headers = ['date', 'room', 'slot', 'teacher', 'class', 'source', 'created_at']
      const rows = data.map((b) => [
        b.date,
        b.rooms?.name || b.room_id,
        b.room_slots ? `${b.room_slots.start_time}-${b.room_slots.end_time}` : b.room_slot_id,
        b.teacher_name,
        b.class_name,
        b.source,
        b.created_at,
      ])
      const csv = [headers, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\n')
      return {
        statusCode: 200,
        headers: {
          ...CORS,
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="prenotazioni.csv"',
        },
        body: csv,
      }
    }

    return json(200, data)
  }

  return json(405, { error: 'Method not allowed' })
})
