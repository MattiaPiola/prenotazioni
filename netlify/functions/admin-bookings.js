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

  // DELETE /api/admin/bookings/:id
  const deleteMatch = path.match(/admin\/bookings\/([^/]+)$/)

  if (deleteMatch && method === 'DELETE') {
    const id = deleteMatch[1]
    // For room-admins, verify they have access to the booking's room
    if (!ctx.is_superadmin) {
      const { data: booking } = await supabase.from('bookings').select('room_id').eq('id', id).single()
      if (!booking) return json(404, { error: 'Booking not found' })
      try {
        await requireRoomAccess(ctx, booking.room_id, supabase)
      } catch (err) {
        return json(err.status || 403, { error: err.message })
      }
    }
    const { error } = await supabase.from('bookings').delete().eq('id', id)
    if (error) return json(500, { error: error.message })
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
      query = query.in('room_id', permittedRoomIds.length > 0 ? permittedRoomIds : ['00000000-0000-0000-0000-000000000000'])
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
