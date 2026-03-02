import { getSupabase } from './_supabase.js'
import { requireAdmin } from './_auth.js'

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

export async function handler(event) {
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

  if (approveMatch && method === 'POST') {
    const id = approveMatch[1]

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

    // Insert bookings, ignoring conflicts
    const bookingsToInsert = dates.map((date) => ({
      room_id: req.room_id,
      room_slot_id: req.room_slot_id,
      date,
      teacher_name: req.teacher_name,
      class_name: req.class_name,
      source: 'recurring',
      recurring_request_id: id,
    }))

    const conflicts = []
    const inserted = []

    for (const booking of bookingsToInsert) {
      const { data, error } = await supabase
        .from('bookings')
        .insert(booking)
        .select()
        .single()
      if (error) {
        if (error.code === '23505') {
          conflicts.push(booking.date)
        } else {
          return json(500, { error: error.message })
        }
      } else {
        inserted.push(data)
      }
    }

    // Update request status
    const { error: updateErr } = await supabase
      .from('recurring_requests')
      .update({ status: 'approved', decided_at: new Date().toISOString() })
      .eq('id', id)
    if (updateErr) return json(500, { error: updateErr.message })

    return json(200, {
      ok: true,
      inserted: inserted.length,
      conflicts,
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
}
