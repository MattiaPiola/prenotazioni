async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const data = await res.json()
      message = data.error || data.message || message
    } catch (_) {}
    const err = new Error(message)
    err.status = res.status
    throw err
  }
  if (res.status === 204) return null
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) return res.json()
  return res
}

export const getRooms = () => apiFetch('/api/rooms')

export const getRoomSlots = (roomId) => apiFetch(`/api/rooms/${roomId}/slots`)

export const getRoomBookings = (roomId, dateFrom, dateTo) =>
  apiFetch(`/api/rooms/${roomId}/bookings?date_from=${dateFrom}&date_to=${dateTo}`)

export const createBooking = (data) =>
  apiFetch('/api/bookings', { method: 'POST', body: JSON.stringify(data) })

export const createRecurringRequest = (data) =>
  apiFetch('/api/recurring-requests', { method: 'POST', body: JSON.stringify(data) })

export const adminLogin = (code) =>
  apiFetch('/api/admin/login', { method: 'POST', body: JSON.stringify({ code }) })

export const adminLogout = () =>
  apiFetch('/api/admin/logout', { method: 'POST', body: JSON.stringify({}) })

export const adminGetRooms = () => apiFetch('/api/admin/rooms')

export const adminCreateRoom = (name) =>
  apiFetch('/api/admin/rooms', { method: 'POST', body: JSON.stringify({ name }) })

export const adminUpdateRoom = (id, data) =>
  apiFetch(`/api/admin/rooms/${id}`, { method: 'PATCH', body: JSON.stringify(data) })

export const adminDuplicateRoom = (id) =>
  apiFetch(`/api/admin/rooms/${id}/duplicate`, { method: 'POST', body: JSON.stringify({}) })

export const adminDeleteRoom = (id) =>
  apiFetch(`/api/admin/rooms/${id}`, { method: 'DELETE' })

export const adminGetSlots = (roomId) => apiFetch(`/api/admin/rooms/${roomId}/slots`)

export const adminCreateSlot = (roomId, data) =>
  apiFetch(`/api/admin/rooms/${roomId}/slots`, { method: 'POST', body: JSON.stringify(data) })

export const adminUpdateSlot = (roomId, slotId, data) =>
  apiFetch(`/api/admin/rooms/${roomId}/slots/${slotId}`, { method: 'PATCH', body: JSON.stringify(data) })

export const adminDeleteSlot = (roomId, slotId) =>
  apiFetch(`/api/admin/rooms/${roomId}/slots/${slotId}`, { method: 'DELETE' })

export const adminGetRecurringRequests = (status) => {
  const qs = status ? `?status=${status}` : ''
  return apiFetch(`/api/admin/recurring-requests${qs}`)
}

export const adminApproveRecurring = async (id, action) => {
  const body = action ? { action } : {}
  const res = await fetch(`/api/admin/recurring-requests/${id}/approve`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (res.status === 409) {
    const data = await res.json()
    return { hasConflicts: true, ...data }
  }
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try { const d = await res.json(); message = d.error || message } catch (_) {}
    const err = new Error(message)
    err.status = res.status
    throw err
  }
  return res.json()
}

export const adminDenyRecurring = (id, notes) =>
  apiFetch(`/api/admin/recurring-requests/${id}/deny`, { method: 'POST', body: JSON.stringify({ notes }) })

export const adminGetBookings = ({ from, to, room_id } = {}) => {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  if (room_id) params.set('room_id', room_id)
  return apiFetch(`/api/admin/bookings?${params}`)
}

export const adminCancelBooking = (id) =>
  apiFetch(`/api/admin/bookings/${id}`, { method: 'DELETE' })

export const adminGetBlockedSlots = ({ room_id, date_from, date_to } = {}) => {
  const params = new URLSearchParams()
  if (room_id) params.set('room_id', room_id)
  if (date_from) params.set('date_from', date_from)
  if (date_to) params.set('date_to', date_to)
  return apiFetch(`/api/admin/blocked-slots?${params}`)
}

export const adminBlockSlot = (data) =>
  apiFetch('/api/admin/blocked-slots', { method: 'POST', body: JSON.stringify(data) })

export const adminUnblockSlot = (id) =>
  apiFetch(`/api/admin/blocked-slots/${id}`, { method: 'DELETE' })

export const getRoomBlockedSlots = (roomId, dateFrom, dateTo) => {
  const params = new URLSearchParams()
  if (dateFrom) params.set('date_from', dateFrom)
  if (dateTo) params.set('date_to', dateTo)
  return apiFetch(`/api/rooms/${roomId}/blocked-slots?${params}`)
}

export const cancelBooking = (id) =>
  apiFetch(`/api/bookings/${id}`, { method: 'DELETE' })

export const adminDeleteRecurringBookings = (id) =>
  apiFetch(`/api/admin/recurring-requests/${id}/bookings`, { method: 'DELETE' })

export const adminUpdateRecurringDates = async (id, { start_date, end_date, action } = {}) => {
  const body = { start_date, end_date }
  if (action) body.action = action
  const res = await fetch(`/api/admin/recurring-requests/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (res.status === 409) {
    const data = await res.json()
    return { hasConflicts: true, ...data }
  }
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try { const d = await res.json(); message = d.error || message } catch (_) {}
    const err = new Error(message)
    err.status = res.status
    throw err
  }
  return res.json()
}

export const adminExportBookingsCSV = async ({ from, to, room_id } = {}) => {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  if (room_id) params.set('room_id', room_id)
  params.set('format', 'csv')
  const res = await fetch(`/api/admin/bookings?${params}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.blob()
}

export const adminGetMe = () => apiFetch('/api/admin/me')

export const adminGetAdminUsers = () => apiFetch('/api/admin/admin-users')

export const adminCreateAdminUser = (data) =>
  apiFetch('/api/admin/admin-users', { method: 'POST', body: JSON.stringify(data) })

export const adminUpdateAdminUser = (id, data) =>
  apiFetch(`/api/admin/admin-users/${id}`, { method: 'PATCH', body: JSON.stringify(data) })

export const adminDeleteAdminUser = (id) =>
  apiFetch(`/api/admin/admin-users/${id}`, { method: 'DELETE' })

export const adminSetAdminUserRooms = (id, room_ids) =>
  apiFetch(`/api/admin/admin-users/${id}/rooms`, { method: 'POST', body: JSON.stringify({ room_ids }) })
