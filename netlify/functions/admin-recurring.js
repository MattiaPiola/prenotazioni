import { getSupabase } from './_supabase.js'
import { requireAdmin } from './_auth.js'
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

  try {
    requireAdmin(event)
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

  // DELETE /api/admin/recurring-requests/:id/bookings
  const deleteBookingsMatch = path.match(/recurring-requests\/([^/]+)\/bookings$/)

  if (deleteBookingsMatch && method === 'DELETE') {
    const id = deleteBookingsMatch[1]
    const { data: req, error: reqErr } = await supabase
      .from('recurring_requests')
      .select('id')
      .eq('id', id)
      .single()
    if (reqErr || !req) return json(404, { error: 'Request not found' })

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

    const { error } = await supabase
      .from('recurring_requests')
      .update({ status: 'denied', decided_at: new Date().toISOString(), admin_notes: notes || null })
      .eq('id', id)
    if (error) return json(500, { error: error.message })
    return json(200, { ok: true })
  }

  if (method === 'GET') {
    const params = event.queryStringParameters || {}
    let query = supabase
      .from('recurring_requests')
      .select('*, rooms(name), room_slots(start_time, end_time, label)')
      .order('created_at', { ascending: false })
    if (params.status) {
      query = query.eq('status', params.status)
    }
    const { data, error } = await query
    if (error) return json(500, { error: error.message })
    return json(200, data)
  }

  return json(405, { error: 'Method not allowed' })
})
