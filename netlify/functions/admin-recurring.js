import { getSupabase } from './_supabase.js'
import { requireAdmin, requireRoomAccess, getPermittedRoomIds } from './_auth.js'
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

function formatDate(date) {
  return date.toISOString().slice(0, 10)
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

  // POST /api/admin/recurring-requests/:id/approve
  const approveMatch = path.match(/recurring-requests\/([^/]+)\/approve$/)
  // POST /api/admin/recurring-requests/:id/deny
  const denyMatch = path.match(/recurring-requests\/([^/]+)\/deny$/)
  // PATCH /api/admin/recurring-requests/:id
  const updateMatch = path.match(/recurring-requests\/([^/]+)$/)

  // DELETE /api/admin/recurring-requests/:id/bookings
  const deleteBookingsMatch = path.match(/recurring-requests\/([^/]+)\/bookings$/)

  if (deleteBookingsMatch && method === 'DELETE') {
    const id = deleteBookingsMatch[1]
    const { data: req, error: reqErr } = await supabase
      .from('recurring_requests')
      .select('id, room_id')
      .eq('id', id)
      .single()
    if (reqErr || !req) return json(404, { error: 'Request not found' })

    try {
      await requireRoomAccess(ctx, req.room_id, supabase)
    } catch (err) {
      return json(err.status || 403, { error: err.message })
    }

    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('recurring_request_id', id)
    if (error) return json(500, { error: error.message })

    const { error: updateErr } = await supabase
      .from('recurring_requests')
      .update({ status: 'cancelled', decided_at: new Date().toISOString() })
      .eq('id', id)
    if (updateErr) return json(500, { error: updateErr.message })

    return json(200, { ok: true })
  }

  if (approveMatch && method === 'POST') {
    const id = approveMatch[1]

    let body
    try { body = JSON.parse(event.body || '{}') } catch (_) { body = {} }
    // action: undefined (first call) | 'force' (overwrite conflicts) | 'skip' (skip conflict dates)
    const { action } = body

    // Fetch request
    const { data: req, error: reqErr } = await supabase
      .from('recurring_requests')
      .select('*')
      .eq('id', id)
      .single()
    if (reqErr || !req) return json(404, { error: 'Request not found' })
    if (req.status !== 'pending') return json(400, { error: 'Request already decided' })

    try {
      await requireRoomAccess(ctx, req.room_id, supabase)
    } catch (err) {
      return json(err.status || 403, { error: err.message })
    }

    // Generate all dates in range matching weekdays
    const start = new Date(req.start_date + 'T00:00:00')
    const end = new Date(req.end_date + 'T00:00:00')
    const dates = []
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      // getDay(): 0=Sun,1=Mon...6=Sat → weekday 1=Mon..7=Sun
      const weekday = d.getDay() === 0 ? 7 : d.getDay()
      if (req.weekdays.includes(weekday)) {
        dates.push(formatDate(new Date(d)))
      }
    }

    // Fetch max_bookings for this slot
    const { data: slotData, error: slotErr } = await supabase
      .from('room_slots')
      .select('max_bookings')
      .eq('id', req.room_slot_id)
      .single()
    if (slotErr) return json(500, { error: slotErr.message })
    if (!slotData) return json(404, { error: 'Slot not found' })
    const maxBookings = slotData.max_bookings || 1

    const bookingsToInsert = dates.map((date) => ({
      room_id: req.room_id,
      room_slot_id: req.room_slot_id,
      date,
      teacher_name: req.teacher_name,
      class_name: req.class_name,
      source: 'recurring',
      recurring_request_id: id,
    }))

    // First pass: categorize dates into conflicting (slot full) vs non-conflicting
    const conflictItems = []
    const clearItems = []

    for (const booking of bookingsToInsert) {
      const { data: existing, error: findErr } = await supabase
        .from('bookings')
        .select('id, teacher_name, class_name, source')
        .eq('room_id', booking.room_id)
        .eq('room_slot_id', booking.room_slot_id)
        .eq('date', booking.date)
      if (findErr) return json(500, { error: findErr.message })

      if (existing && existing.length >= maxBookings) {
        conflictItems.push({ booking, existing })
      } else {
        clearItems.push(booking)
      }
    }

    // If there are conflicts and no action specified, return them for the admin to resolve
    if (conflictItems.length > 0 && !action) {
      return json(409, {
        error: 'conflicts',
        conflicts: conflictItems.map(({ booking, existing }) => ({
          date: booking.date,
          existing: existing.map((b) => ({
            id: b.id,
            teacher_name: b.teacher_name,
            class_name: b.class_name,
            source: b.source,
          })),
        })),
      })
    }

    const overwritten = []
    const inserted = []

    // Insert non-conflicting bookings
    for (const booking of clearItems) {
      const { data, error } = await supabase
        .from('bookings')
        .insert(booking)
        .select()
        .single()
      if (error) return json(500, { error: error.message })
      inserted.push(data)
    }

    // Handle conflicting dates based on action
    if (action === 'force') {
      for (const { booking, existing } of conflictItems) {
        const { error: deleteErr } = await supabase
          .from('bookings')
          .delete()
          .in('id', existing.map((b) => b.id))
        if (deleteErr) return json(500, { error: deleteErr.message })
        overwritten.push(booking.date)

        const { data, error } = await supabase
          .from('bookings')
          .insert(booking)
          .select()
          .single()
        if (error) return json(500, { error: error.message })
        inserted.push(data)
      }
    }
    // action === 'skip': conflicting dates are simply not inserted

    // Update request status
    const { error: updateErr } = await supabase
      .from('recurring_requests')
      .update({ status: 'approved', decided_at: new Date().toISOString() })
      .eq('id', id)
    if (updateErr) return json(500, { error: updateErr.message })

    return json(200, {
      ok: true,
      inserted: inserted.length,
      overwritten,
      skipped: action === 'skip' ? conflictItems.map(({ booking }) => booking.date) : [],
    })
  }

  if (denyMatch && method === 'POST') {
    const id = denyMatch[1]
    let body
    try { body = JSON.parse(event.body || '{}') } catch (_) { body = {} }
    const { notes } = body

    // Check room access
    const { data: req, error: reqErr } = await supabase
      .from('recurring_requests')
      .select('room_id')
      .eq('id', id)
      .single()
    if (reqErr || !req) return json(404, { error: 'Request not found' })
    try {
      await requireRoomAccess(ctx, req.room_id, supabase)
    } catch (err) {
      return json(err.status || 403, { error: err.message })
    }

    const { error } = await supabase
      .from('recurring_requests')
      .update({ status: 'denied', decided_at: new Date().toISOString(), admin_notes: notes || null })
      .eq('id', id)
    if (error) return json(500, { error: error.message })
    return json(200, { ok: true })
  }

  if (updateMatch && method === 'PATCH') {
    const id = updateMatch[1]
    let body
    try { body = JSON.parse(event.body || '{}') } catch (_) { body = {} }
    const { start_date, end_date, action } = body

    if (!start_date || !end_date) return json(400, { error: 'start_date and end_date are required' })

    const { data: req, error: reqErr } = await supabase
      .from('recurring_requests')
      .select('*')
      .eq('id', id)
      .single()
    if (reqErr || !req) return json(404, { error: 'Request not found' })
    if (req.status !== 'approved') return json(400, { error: 'Can only update dates of approved requests' })

    try {
      await requireRoomAccess(ctx, req.room_id, supabase)
    } catch (err) {
      return json(err.status || 403, { error: err.message })
    }

    const newStart = new Date(start_date + 'T00:00:00')
    const newEnd = new Date(end_date + 'T00:00:00')
    if (newEnd < newStart) return json(400, { error: 'end_date must be after start_date' })
    const diffDays = (newEnd - newStart) / (1000 * 60 * 60 * 24)
    if (diffDays > 365) return json(400, { error: 'Date range cannot exceed 365 days' })

    // Generate old and new date sets
    const generateDates = (startStr, endStr) => {
      const dates = new Set()
      const s = new Date(startStr + 'T00:00:00')
      const e = new Date(endStr + 'T00:00:00')
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        const weekday = d.getDay() === 0 ? 7 : d.getDay()
        if (req.weekdays.includes(weekday)) dates.add(formatDate(new Date(d)))
      }
      return dates
    }

    const oldDates = generateDates(req.start_date, req.end_date)
    const newDates = generateDates(start_date, end_date)

    const datesToRemove = [...oldDates].filter((d) => !newDates.has(d))
    const datesToAdd = [...newDates].filter((d) => !oldDates.has(d))

    // Delete bookings for removed dates
    if (datesToRemove.length > 0) {
      const { error: delErr } = await supabase
        .from('bookings')
        .delete()
        .eq('recurring_request_id', id)
        .in('date', datesToRemove)
      if (delErr) return json(500, { error: delErr.message })
    }

    // Fetch max_bookings for the slot
    const { data: slotData, error: slotErr } = await supabase
      .from('room_slots')
      .select('max_bookings')
      .eq('id', req.room_slot_id)
      .single()
    if (slotErr) return json(500, { error: slotErr.message })
    const maxBookings = slotData?.max_bookings || 1

    // Check conflicts for dates to add
    const conflictItems = []
    const clearItems = []
    for (const date of datesToAdd) {
      const { data: existing, error: findErr } = await supabase
        .from('bookings')
        .select('id, teacher_name, class_name, source')
        .eq('room_id', req.room_id)
        .eq('room_slot_id', req.room_slot_id)
        .eq('date', date)
      if (findErr) return json(500, { error: findErr.message })
      if (existing && existing.length >= maxBookings) {
        conflictItems.push({ date, existing })
      } else {
        clearItems.push(date)
      }
    }

    if (conflictItems.length > 0 && !action) {
      return json(409, {
        error: 'conflicts',
        conflicts: conflictItems.map(({ date, existing }) => ({
          date,
          existing: existing.map((b) => ({ id: b.id, teacher_name: b.teacher_name, class_name: b.class_name, source: b.source })),
        })),
      })
    }

    const overwritten = []
    // Insert non-conflicting bookings
    for (const date of clearItems) {
      const { error: insErr } = await supabase
        .from('bookings')
        .insert({ room_id: req.room_id, room_slot_id: req.room_slot_id, date, teacher_name: req.teacher_name, class_name: req.class_name, source: 'recurring', recurring_request_id: id })
      if (insErr) return json(500, { error: insErr.message })
    }

    if (action === 'force') {
      for (const { date, existing } of conflictItems) {
        const { error: deleteErr } = await supabase
          .from('bookings')
          .delete()
          .in('id', existing.map((b) => b.id))
        if (deleteErr) return json(500, { error: deleteErr.message })
        overwritten.push(date)
        const { error: insErr } = await supabase
          .from('bookings')
          .insert({ room_id: req.room_id, room_slot_id: req.room_slot_id, date, teacher_name: req.teacher_name, class_name: req.class_name, source: 'recurring', recurring_request_id: id })
        if (insErr) return json(500, { error: insErr.message })
      }
    }

    // Update recurring request dates
    const { error: updateErr } = await supabase
      .from('recurring_requests')
      .update({ start_date, end_date })
      .eq('id', id)
    if (updateErr) return json(500, { error: updateErr.message })

    return json(200, {
      ok: true,
      removed: datesToRemove.length,
      added: clearItems.length + overwritten.length,
      overwritten,
      skipped: action === 'skip' ? conflictItems.map(({ date }) => date) : [],
    })
  }

  if (method === 'GET') {
    const params = event.queryStringParameters || {}
    const permittedRoomIds = await getPermittedRoomIds(ctx, supabase)
    let query = supabase
      .from('recurring_requests')
      .select('*, rooms(name), room_slots(start_time, end_time, label)')
      .order('created_at', { ascending: false })
    if (params.status) {
      query = query.eq('status', params.status)
    }
    if (permittedRoomIds !== null) {
      if (permittedRoomIds.length === 0) return json(200, [])
      query = query.in('room_id', permittedRoomIds)
    }
    const { data, error } = await query
    if (error) return json(500, { error: error.message })
    return json(200, data)
  }

  return json(405, { error: 'Method not allowed' })
})
