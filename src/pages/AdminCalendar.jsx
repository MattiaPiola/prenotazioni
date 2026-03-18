import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  adminGetRooms,
  adminGetSlots,
  adminGetBookings,
  adminCancelBooking,
  adminCreateBooking,
  adminUpdateBooking,
  adminCreateRecurringBooking,
  adminGetBlockedSlots,
  adminBlockSlot,
  adminUnblockSlot,
  adminGetRecurringRequest,
  adminDeleteRecurringBookings,
  adminUpdateRecurringDates,
} from '../lib/api.js'
import { getWeekDates, formatDate, formatDisplayDate, DAY_NAMES } from '../lib/dates.js'

function weekdayNames(days) {
  return days.map((d) => DAY_NAMES[d - 1]).join(', ')
}

export default function AdminCalendar() {
  const [rooms, setRooms] = useState([])
  const [selectedRoom, setSelectedRoom] = useState('')
  const [slots, setSlots] = useState([])
  const [bookings, setBookings] = useState([])
  const [blocked, setBlocked] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [weekOffset, setWeekOffset] = useState(0)

  // Recurring management modal state
  const [recurringModal, setRecurringModal] = useState(null)
  const [recurringRequest, setRecurringRequest] = useState(null)
  const [recurringModalLoading, setRecurringModalLoading] = useState(false)
  const [recurringModalError, setRecurringModalError] = useState(null)
  const [recurringModalSuccess, setRecurringModalSuccess] = useState(null)
  const [showRecurringEditDates, setShowRecurringEditDates] = useState(false)
  const [recurringEditStartDate, setRecurringEditStartDate] = useState('')
  const [recurringEditEndDate, setRecurringEditEndDate] = useState('')
  const [recurringEditConflicts, setRecurringEditConflicts] = useState(null)

  // Add/Edit booking modal state
  const [bookingModal, setBookingModal] = useState(null)
  // { mode: 'add', slotId, date, roomId } | { mode: 'edit', booking }
  const [bookingForm, setBookingForm] = useState({ teacher_name: '', class_name: '', booking_type: 'single', start_date: '', end_date: '', weekdays: [] })
  const [bookingModalLoading, setBookingModalLoading] = useState(false)
  const [bookingModalError, setBookingModalError] = useState(null)
  const [bookingModalConflicts, setBookingModalConflicts] = useState(null)

  // Mass edit mode state
  const [massEditMode, setMassEditMode] = useState(false)
  const [selectedSlots, setSelectedSlots] = useState([])
  const [massModal, setMassModal] = useState(false)
  const [massForm, setMassForm] = useState({ teacher_name: '', class_name: '', booking_type: 'single', start_date: '', end_date: '', weekdays: [] })
  const [massLoading, setMassLoading] = useState(false)
  const [massError, setMassError] = useState(null)
  const [massConflicts, setMassConflicts] = useState(null)
  const [massConflictingSlots, setMassConflictingSlots] = useState(null)

  const weekDates = getWeekDates(weekOffset)
  const dateFrom = formatDate(weekDates[0])
  const dateTo = formatDate(weekDates[6])
  const weekLabel = `${formatDisplayDate(weekDates[0])} – ${formatDisplayDate(weekDates[6])}`

  // Load rooms on mount
  useEffect(() => {
    adminGetRooms()
      .then((data) => {
        setRooms(data)
        if (data.length > 0) setSelectedRoom(data[0].id)
      })
      .catch((e) => setError(e.message))
  }, [])

  // Load calendar data when room or week changes
  useEffect(() => {
    if (!selectedRoom) return
    setLoading(true)
    setError(null)
    Promise.all([
      adminGetSlots(selectedRoom),
      adminGetBookings({ from: dateFrom, to: dateTo, room_id: selectedRoom }),
      adminGetBlockedSlots({ room_id: selectedRoom, date_from: dateFrom, date_to: dateTo }),
    ])
      .then(([slotsData, bookingsData, blockedData]) => {
        setSlots(slotsData)
        setBookings(bookingsData)
        setBlocked(blockedData)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [selectedRoom, dateFrom, dateTo])

  const reload = () => {
    if (!selectedRoom) return
    setLoading(true)
    Promise.all([
      adminGetSlots(selectedRoom),
      adminGetBookings({ from: dateFrom, to: dateTo, room_id: selectedRoom }),
      adminGetBlockedSlots({ room_id: selectedRoom, date_from: dateFrom, date_to: dateTo }),
    ])
      .then(([slotsData, bookingsData, blockedData]) => {
        setSlots(slotsData)
        setBookings(bookingsData)
        setBlocked(blockedData)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  const getBookingsForSlot = (slotId, date) =>
    bookings.filter((b) => b.room_slot_id === slotId && b.date === date)

  const getBlock = (slotId, date) =>
    blocked.find((b) => b.room_slot_id === slotId && b.date === date)

  const handleCancelBooking = async (id) => {
    if (!confirm('Annullare questa prenotazione?')) return
    try {
      await adminCancelBooking(id)
      reload()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDisableSlot = async (slotId, date) => {
    try {
      await adminBlockSlot({ room_id: selectedRoom, room_slot_id: slotId, date, type: 'disabled' })
      reload()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleLockSlot = async (slotId, date) => {
    try {
      await adminBlockSlot({ room_id: selectedRoom, room_slot_id: slotId, date, type: 'locked' })
      reload()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleUnblockSlot = async (slotId, date) => {
    const existingBlock = getBlock(slotId, date)
    if (!existingBlock) return
    try {
      await adminUnblockSlot(existingBlock.id)
      reload()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDisableDay = async (dayIdx) => {
    const dateStr = formatDate(weekDates[dayIdx])
    const unblockedSlots = slots.filter((slot) => !getBlock(slot.id, dateStr))
    if (unblockedSlots.length === 0) return
    try {
      await adminBlockSlot({
        room_id: selectedRoom,
        type: 'disabled',
        slots: unblockedSlots.map((slot) => ({ room_slot_id: slot.id, date: dateStr })),
      })
      reload()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleLockDay = async (dayIdx) => {
    const dateStr = formatDate(weekDates[dayIdx])
    const unblockedSlots = slots.filter((slot) => !getBlock(slot.id, dateStr))
    if (unblockedSlots.length === 0) return
    try {
      await adminBlockSlot({
        room_id: selectedRoom,
        type: 'locked',
        slots: unblockedSlots.map((slot) => ({ room_slot_id: slot.id, date: dateStr })),
      })
      reload()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleUnlockDay = async (dayIdx) => {
    const dateStr = formatDate(weekDates[dayIdx])
    const blockedForDay = blocked.filter((b) => b.date === dateStr)
    if (blockedForDay.length === 0) return
    try {
      await Promise.all(blockedForDay.map((b) => adminUnblockSlot(b.id)))
      reload()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleOpenAddBooking = (slotId, date) => {
    const d = new Date(date + 'T00:00:00')
    const weekday = d.getDay() === 0 ? 7 : d.getDay()
    setBookingModal({ mode: 'add', slotId, date, roomId: selectedRoom })
    setBookingForm({ teacher_name: '', class_name: '', booking_type: 'single', start_date: date, end_date: date, weekdays: [weekday] })
    setBookingModalError(null)
    setBookingModalConflicts(null)
  }

  const handleOpenEditBooking = (booking) => {
    setBookingModal({ mode: 'edit', booking })
    setBookingForm({ teacher_name: booking.teacher_name, class_name: booking.class_name || '', booking_type: 'single', start_date: '', end_date: '', weekdays: [] })
    setBookingModalError(null)
    setBookingModalConflicts(null)
  }

  const handleCloseBookingModal = () => {
    setBookingModal(null)
    setBookingModalError(null)
    setBookingModalConflicts(null)
  }

  // Mass edit helpers
  const isSlotSelected = (slotId, date) =>
    selectedSlots.some((s) => s.slotId === slotId && s.date === date)

  const handleToggleMassSelect = (slotId, date) => {
    const slotData = slots.find((s) => s.id === slotId)
    setSelectedSlots((prev) => {
      const exists = prev.some((s) => s.slotId === slotId && s.date === date)
      if (exists) return prev.filter((s) => !(s.slotId === slotId && s.date === date))
      return [...prev, { slotId, date, slot: slotData }]
    })
  }

  const handleEnterMassEdit = () => {
    setMassEditMode(true)
    setSelectedSlots([])
  }

  const handleExitMassEdit = () => {
    setMassEditMode(false)
    setSelectedSlots([])
    setMassModal(false)
    setMassError(null)
    setMassConflicts(null)
    setMassConflictingSlots(null)
  }

  const handleOpenMassModal = () => {
    setMassForm({ teacher_name: '', class_name: '', booking_type: 'single', start_date: '', end_date: '', weekdays: [] })
    setMassError(null)
    setMassConflicts(null)
    setMassConflictingSlots(null)
    setMassModal(true)
  }

  const handleCloseMassModal = () => {
    setMassModal(false)
    setMassError(null)
    setMassConflicts(null)
    setMassConflictingSlots(null)
  }

  const handleMassSubmit = async (action) => {
    setMassLoading(true)
    setMassError(null)
    try {
      const targetSlots = massConflictingSlots ?? selectedSlots
      if (massForm.booking_type === 'single') {
        await Promise.all(targetSlots.map((s) =>
          adminCreateBooking({
            room_id: selectedRoom,
            room_slot_id: s.slotId,
            date: s.date,
            teacher_name: massForm.teacher_name,
            class_name: massForm.class_name || null,
          })
        ))
        handleCloseMassModal()
        setSelectedSlots([])
        setMassEditMode(false)
        reload()
      } else {
        const newConflicts = []
        const newConflictingSlots = []
        for (const s of targetSlots) {
          const res = await adminCreateRecurringBooking({
            room_id: selectedRoom,
            room_slot_id: s.slotId,
            teacher_name: massForm.teacher_name,
            class_name: massForm.class_name || null,
            start_date: massForm.start_date,
            end_date: massForm.end_date,
            weekdays: massForm.weekdays,
            action,
          })
          if (res.hasConflicts) {
            newConflicts.push(...res.conflicts)
            newConflictingSlots.push(s)
          }
        }
        if (newConflicts.length > 0) {
          setMassConflicts(newConflicts)
          setMassConflictingSlots(newConflictingSlots)
        } else {
          handleCloseMassModal()
          setSelectedSlots([])
          setMassEditMode(false)
          reload()
        }
      }
    } catch (err) {
      setMassError(err.message)
    } finally {
      setMassLoading(false)
    }
  }

  const handleBookingModalSubmit = async (action) => {
    setBookingModalLoading(true)
    setBookingModalError(null)
    setBookingModalConflicts(null)
    try {
      if (bookingModal.mode === 'edit') {
        await adminUpdateBooking(bookingModal.booking.id, {
          teacher_name: bookingForm.teacher_name,
          class_name: bookingForm.class_name || null,
        })
        handleCloseBookingModal()
        reload()
      } else if (bookingForm.booking_type === 'single') {
        await adminCreateBooking({
          room_id: bookingModal.roomId,
          room_slot_id: bookingModal.slotId,
          date: bookingModal.date,
          teacher_name: bookingForm.teacher_name,
          class_name: bookingForm.class_name || null,
        })
        handleCloseBookingModal()
        reload()
      } else {
        const res = await adminCreateRecurringBooking({
          room_id: bookingModal.roomId,
          room_slot_id: bookingModal.slotId,
          teacher_name: bookingForm.teacher_name,
          class_name: bookingForm.class_name || null,
          start_date: bookingForm.start_date,
          end_date: bookingForm.end_date,
          weekdays: bookingForm.weekdays,
          action,
        })
        if (res.hasConflicts) {
          setBookingModalConflicts(res.conflicts)
        } else {
          handleCloseBookingModal()
          reload()
        }
      }
    } catch (err) {
      setBookingModalError(err.message)
    } finally {
      setBookingModalLoading(false)
    }
  }

  const handleOpenRecurringModal = async (booking) => {
    if (!booking.recurring_request_id) return
    setRecurringModal(booking)
    setRecurringRequest(null)
    setRecurringModalLoading(true)
    setRecurringModalError(null)
    setRecurringModalSuccess(null)
    setShowRecurringEditDates(false)
    setRecurringEditConflicts(null)
    try {
      const req = await adminGetRecurringRequest(booking.recurring_request_id)
      setRecurringRequest(req)
      setRecurringEditStartDate(req.start_date)
      setRecurringEditEndDate(req.end_date)
    } catch (err) {
      setRecurringModalError(err.message)
    } finally {
      setRecurringModalLoading(false)
    }
  }

  const handleCloseRecurringModal = () => {
    setRecurringModal(null)
    setRecurringRequest(null)
    setRecurringModalError(null)
    setRecurringModalSuccess(null)
    setShowRecurringEditDates(false)
    setRecurringEditConflicts(null)
  }

  const handleRecurringDeleteBookings = async () => {
    if (!confirm('Eliminare tutte le prenotazioni ricorrenti generate da questa richiesta?')) return
    setRecurringModalLoading(true)
    setRecurringModalError(null)
    try {
      await adminDeleteRecurringBookings(recurringRequest.id)
      setRecurringModalSuccess('🗑️ Tutte le prenotazioni ricorrenti sono state eliminate.')
      setRecurringRequest((prev) => prev ? { ...prev, status: 'cancelled' } : null)
      reload()
    } catch (err) {
      setRecurringModalError(err.message)
    } finally {
      setRecurringModalLoading(false)
    }
  }

  const handleRecurringUpdateDates = async (action) => {
    setRecurringModalLoading(true)
    setRecurringModalError(null)
    try {
      const res = await adminUpdateRecurringDates(recurringRequest.id, {
        start_date: recurringEditStartDate,
        end_date: recurringEditEndDate,
        action,
      })
      if (res.hasConflicts) {
        setRecurringEditConflicts(res.conflicts)
      } else {
        setRecurringEditConflicts(null)
        setShowRecurringEditDates(false)
        const parts = []
        if (res.added > 0) parts.push(`Aggiunte: ${res.added}`)
        if (res.removed > 0) parts.push(`Rimosse: ${res.removed}`)
        if (res.overwritten && res.overwritten.length > 0) parts.push(`Sovrascritte: ${res.overwritten.join(', ')}`)
        if (res.skipped && res.skipped.length > 0) parts.push(`Saltate: ${res.skipped.join(', ')}`)
        setRecurringModalSuccess('✅ Date aggiornate. ' + (parts.length > 0 ? parts.join(' · ') : 'Nessuna modifica.'))
        const updatedReq = await adminGetRecurringRequest(recurringRequest.id)
        setRecurringRequest(updatedReq)
        setRecurringEditStartDate(updatedReq.start_date)
        setRecurringEditEndDate(updatedReq.end_date)
        reload()
      }
    } catch (err) {
      setRecurringModalError(err.message)
    } finally {
      setRecurringModalLoading(false)
    }
  }

  const selectedRoomData = rooms.find((r) => r.id === selectedRoom)
  const visibleDays = selectedRoomData?.visible_weekdays ?? [0, 1, 2, 3, 4, 5, 6]
  const visibleDayIndices = weekDates
    .map((_, i) => i)
    .filter((i) => visibleDays.includes(i))

  return (
    <>
      <nav className="nav">
        <Link to="/admin/dashboard" className="nav-back">← Dashboard</Link>
        <span className="nav-title">Calendario Admin</span>
      </nav>

      <div className="page-wide">
        {error && <div className="error-msg">⚠️ {error}</div>}

        {/* Controls */}
        <div className="filter-bar" style={{ marginBottom: '1rem' }}>
          <div className="form-group">
            <label>Laboratorio</label>
            <select value={selectedRoom} onChange={(e) => setSelectedRoom(e.target.value)}>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            {massEditMode ? (
              <button className="btn btn-secondary btn-sm" onClick={handleExitMassEdit}>
                ✕ Esci selezione multipla
              </button>
            ) : (
              <button className="btn btn-secondary btn-sm" onClick={handleEnterMassEdit}>
                ☑ Selezione multipla
              </button>
            )}
          </div>
        </div>

        {/* Week navigation */}
        <div className="week-nav">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setWeekOffset((o) => o - 1)}
          >
            ← Settimana precedente
          </button>
          <span className="week-nav-label">📅 {weekLabel}</span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setWeekOffset((o) => o + 1)}
          >
            Settimana successiva →
          </button>
        </div>

        <p style={{ fontSize: '0.82rem', color: 'var(--gray-700)', marginBottom: '1rem' }}>
          {massEditMode
            ? '☑️ Modalità selezione multipla attiva. Clicca sugli slot disponibili per selezionarli, poi usa il pannello in basso per creare le prenotazioni.'
            : '💡 Clicca 🚫 per disabilitare uno slot (non disponibile, nessuna prenotazione) o 🔒 per bloccarlo (prenotazioni esistenti protette, nessuna modifica). Usa 🔓 per sbloccare. Usa ✚ per aggiungere una prenotazione e ✏️ per modificarla.'}
        </p>

        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : slots.length === 0 ? (
          <div className="empty-state">Nessun orario configurato per questo laboratorio.</div>
        ) : (
          <div className="week-grid-wrapper">
            <div className="week-grid">
              {/* Header */}
              <div
                className="week-grid-header"
                style={{ gridTemplateColumns: `100px repeat(${visibleDayIndices.length}, 1fr)` }}
              >
                <div className="week-grid-header-cell">Ora</div>
                {visibleDayIndices.map((i) => {
                  const dateStr = formatDate(weekDates[i])
                  const dayBlocked = blocked.filter((b) => b.date === dateStr)
                  const allBlocked = slots.length > 0 && dayBlocked.length >= slots.length
                  const btnStyle = {
                    marginTop: '2px',
                    background: 'none',
                    border: '1px solid currentColor',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.62rem',
                    padding: '1px 4px',
                    opacity: 0.8,
                  }
                  return (
                    <div key={i} className="week-grid-header-cell">
                      <div>{DAY_NAMES[i].slice(0, 3)}</div>
                      <div style={{ fontWeight: 400, opacity: 0.85, fontSize: '0.72rem' }}>
                        {weekDates[i].getDate()}/{weekDates[i].getMonth() + 1}
                      </div>
                      {slots.length > 0 && (
                        allBlocked ? (
                          <button
                            title="Sblocca giornata"
                            onClick={() => handleUnlockDay(i)}
                            style={{ ...btnStyle, marginTop: '4px' }}
                          >
                            🔓
                          </button>
                        ) : (
                          <div style={{ display: 'flex', gap: '2px', marginTop: '4px', justifyContent: 'center' }}>
                            <button
                              title="Disabilita giornata"
                              onClick={() => handleDisableDay(i)}
                              style={btnStyle}
                            >
                              🚫
                            </button>
                            <button
                              title="Blocca giornata (proteggi prenotazioni)"
                              onClick={() => handleLockDay(i)}
                              style={btnStyle}
                            >
                              🔒
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Rows */}
              {slots.map((slot) => (
                <div
                  key={slot.id}
                  className="week-grid-row"
                  style={{ gridTemplateColumns: `100px repeat(${visibleDayIndices.length}, 1fr)` }}
                >
                  <div className="week-grid-time">
                    <div>
                      <div>{slot.start_time}</div>
                      <div style={{ opacity: 0.7, fontSize: '0.68rem' }}>{slot.end_time}</div>
                      {slot.label && (
                        <div style={{ fontWeight: 400, fontSize: '0.68rem', marginTop: '2px' }}>
                          {slot.label}
                        </div>
                      )}
                      {(slot.max_bookings || 1) > 1 && (
                        <div style={{ fontSize: '0.65rem', color: 'var(--primary)', marginTop: '2px' }}>
                          max {slot.max_bookings}
                        </div>
                      )}
                    </div>
                  </div>
                  {visibleDayIndices.map((dayIdx) => {
                    const dateStr = formatDate(weekDates[dayIdx])
                    const slotBookings = getBookingsForSlot(slot.id, dateStr)
                    const block = getBlock(slot.id, dateStr)
                    const isDisabled = block?.type === 'disabled'
                    const isLocked = block?.type === 'locked'
                    const isBlocked = !!block
                    const maxBookings = slot.max_bookings || 1
                    const isFull = !isBlocked && slotBookings.length >= maxBookings
                    const allRecurring = slotBookings.length > 0 && slotBookings.every((b) => b.source === 'recurring')

                    return (
                      <div
                        key={dayIdx}
                        className={`slot-cell ${
                          isDisabled ? 'slot-weekend' :
                          isLocked ? (allRecurring ? 'slot-recurring' : slotBookings.length > 0 ? 'slot-booked' : 'slot-available') :
                          massEditMode && isSlotSelected(slot.id, dateStr) ? 'slot-selected' :
                          allRecurring ? 'slot-recurring' :
                          slotBookings.length > 0 ? (isFull ? 'slot-booked' : 'slot-partial') :
                          'slot-available'
                        }`}
                        style={{
                          padding: '0.4rem', verticalAlign: 'top', minHeight: '3.5rem',
                          ...(massEditMode && !isBlocked && !isFull ? { cursor: 'pointer' } : {}),
                        }}
                        onClick={massEditMode && !isBlocked && !isFull ? () => handleToggleMassSelect(slot.id, dateStr) : undefined}
                      >
                        {massEditMode ? (
                          isDisabled ? (
                            <div style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--gray-700)' }}>🚫</div>
                          ) : isLocked ? (
                            <div style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--gray-700)' }}>🔒</div>
                          ) : isSlotSelected(slot.id, dateStr) ? (
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>✓</div>
                              <div style={{ fontSize: '0.65rem', color: 'var(--primary-dark)', marginTop: '2px' }}>Selezionato</div>
                            </div>
                          ) : isFull ? (
                            <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--gray-700)', opacity: 0.7 }}>
                              {slotBookings.map((b) => b.teacher_name).join(', ')}
                            </div>
                          ) : slotBookings.length > 0 ? (
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: '0.7rem', color: 'var(--gray-700)' }}>{slotBookings.map((b) => b.teacher_name).join(', ')}</div>
                              <div style={{ fontSize: '0.62rem', color: 'var(--gray-500)', marginTop: '2px' }}>+ clicca per aggiungere</div>
                            </div>
                          ) : (
                            <div style={{ textAlign: 'center', fontSize: '0.65rem', color: 'var(--gray-500)', padding: '4px' }}>
                              Clicca per selezionare
                            </div>
                          )
                        ) : isDisabled ? (
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--gray-700)', marginBottom: '0.3rem' }}>
                              🚫 Non disponibile
                            </div>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                              onClick={() => handleUnblockSlot(slot.id, dateStr)}
                            >
                              Abilita
                            </button>
                          </div>
                        ) : isLocked ? (
                          <div>
                            {slotBookings.map((b) => (
                              <div
                                key={b.id}
                                style={{
                                  background: b.source === 'recurring' ? 'var(--recurring-light)' : 'var(--primary-light)',
                                  borderRadius: '4px',
                                  padding: '2px 5px',
                                  marginBottom: '3px',
                                  fontSize: '0.72rem',
                                }}
                              >
                                <div style={{ fontWeight: 600, color: b.source === 'recurring' ? 'var(--recurring)' : undefined }}>
                                  {b.source === 'recurring' && '🔁 '}{b.teacher_name}
                                </div>
                                <div style={{ opacity: 0.8 }}>{b.class_name}</div>
                              </div>
                            ))}
                            {maxBookings > 1 && (
                              <div style={{ fontSize: '0.65rem', color: 'var(--gray-700)', marginBottom: '2px' }}>
                                {slotBookings.length}/{maxBookings}
                              </div>
                            )}
                            <div style={{ marginTop: '4px' }}>
                              <div style={{ fontSize: '0.72rem', color: 'var(--gray-700)', marginBottom: '3px' }}>🔒 Bloccato</div>
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                                onClick={() => handleUnblockSlot(slot.id, dateStr)}
                              >
                                🔓 Sblocca
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            {slotBookings.map((b) => (
                              <div
                                key={b.id}
                                style={{
                                  background: b.source === 'recurring' ? 'var(--recurring-light)' : 'var(--primary-light)',
                                  borderRadius: '4px',
                                  padding: '2px 5px',
                                  marginBottom: '3px',
                                  fontSize: '0.72rem',
                                }}
                              >
                                <div style={{ fontWeight: 600, color: b.source === 'recurring' ? 'var(--recurring)' : undefined }}>
                                  {b.source === 'recurring' && '🔁 '}{b.teacher_name}
                                </div>
                                <div style={{ opacity: 0.8 }}>{b.class_name}</div>
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                  <button
                                    onClick={() => handleCancelBooking(b.id)}
                                    style={{
                                      background: 'none', border: 'none', cursor: 'pointer',
                                      color: 'var(--danger)', fontSize: '0.65rem', padding: '1px 0',
                                    }}
                                  >
                                    🗑️ Annulla
                                  </button>
                                  {(b.source === 'single' || b.recurring_request_id) && (
                                    <button
                                      onClick={() => handleOpenEditBooking(b)}
                                      style={{
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        color: 'var(--primary)', fontSize: '0.65rem', padding: '1px 0',
                                      }}
                                    >
                                      ✏️ {b.source === 'recurring' ? 'Sovrascivi' : 'Modifica'}
                                    </button>
                                  )}
                                  {b.source === 'recurring' && b.recurring_request_id && (
                                    <button
                                      onClick={() => handleOpenRecurringModal(b)}
                                      style={{
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        color: 'var(--recurring)', fontSize: '0.65rem', padding: '1px 0',
                                      }}
                                    >
                                      ⚙️ Gestisci
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                            {maxBookings > 1 && (
                              <div style={{ fontSize: '0.65rem', color: 'var(--gray-700)', marginBottom: '2px' }}>
                                {slotBookings.length}/{maxBookings}
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                              {slotBookings.length < maxBookings && (
                                <button
                                  className="btn btn-primary btn-sm"
                                  style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                                  onClick={() => handleOpenAddBooking(slot.id, dateStr)}
                                >
                                  ✚ Aggiungi
                                </button>
                              )}
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                                onClick={() => handleDisableSlot(slot.id, dateStr)}
                              >
                                🚫 Disabilita
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                                onClick={() => handleLockSlot(slot.id, dateStr)}
                              >
                                🔒 Blocca
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recurring management modal */}
      {recurringModal && (
        <div className="modal-overlay" onClick={handleCloseRecurringModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🔁 Gestione prenotazione ricorrente</h3>
              <button className="modal-close" onClick={handleCloseRecurringModal}>✕</button>
            </div>

            {recurringModalLoading && !recurringRequest ? (
              <div className="loading"><div className="spinner" /></div>
            ) : recurringRequest ? (
              <>
                <div className="request-card-body" style={{ marginBottom: '0.75rem' }}>
                  <span>👤 <strong>{recurringRequest.teacher_name}</strong></span>
                  <span>🏫 {recurringRequest.rooms?.name || recurringRequest.room_id}</span>
                  <span>⏰ {recurringRequest.room_slots
                    ? `${recurringRequest.room_slots.start_time}–${recurringRequest.room_slots.end_time}`
                    : recurringRequest.room_slot_id}
                  </span>
                  <span>🎓 {recurringRequest.class_name}</span>
                  <span>📅 {recurringRequest.start_date} → {recurringRequest.end_date}</span>
                  <span>📆 {weekdayNames(recurringRequest.weekdays)}</span>
                </div>

                {recurringModalError && (
                  <div className="error-msg" style={{ marginBottom: '0.5rem' }}>⚠️ {recurringModalError}</div>
                )}
                {recurringModalSuccess && (
                  <div className="success-msg" style={{ marginBottom: '0.5rem', fontSize: '0.82rem' }}>{recurringModalSuccess}</div>
                )}

                {recurringRequest.status === 'approved' && (
                  <>
                    <div className="request-card-actions">
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={handleRecurringDeleteBookings}
                        disabled={recurringModalLoading}
                      >
                        🗑️ Cancella tutte le prenotazioni
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => { setShowRecurringEditDates(!showRecurringEditDates); setRecurringEditConflicts(null) }}
                        disabled={recurringModalLoading}
                      >
                        ✏️ Modifica date
                      </button>
                    </div>

                    {showRecurringEditDates && (
                      <div style={{ marginTop: '0.75rem', background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-sm)', padding: '0.75rem' }}>
                        <p style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>✏️ Modifica date periodo:</p>
                        <div className="form-row" style={{ marginBottom: '0.5rem' }}>
                          <div className="form-group">
                            <label>Data inizio</label>
                            <input
                              type="date"
                              value={recurringEditStartDate}
                              onChange={(e) => { setRecurringEditStartDate(e.target.value); setRecurringEditConflicts(null) }}
                            />
                          </div>
                          <div className="form-group">
                            <label>Data fine</label>
                            <input
                              type="date"
                              value={recurringEditEndDate}
                              min={recurringEditStartDate}
                              onChange={(e) => { setRecurringEditEndDate(e.target.value); setRecurringEditConflicts(null) }}
                            />
                          </div>
                        </div>
                        {recurringEditConflicts && (
                          <div style={{ marginBottom: '0.75rem', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 'var(--radius-sm)', padding: '0.75rem' }}>
                            <p style={{ fontWeight: 600, marginBottom: '0.4rem', fontSize: '0.9rem' }}>⚠️ Le seguenti date hanno lo slot esaurito:</p>
                            <ul style={{ margin: '0 0 0.6rem 1.1rem', fontSize: '0.82rem', color: 'var(--gray-900)' }}>
                              {recurringEditConflicts.map((c) => (
                                <li key={c.date}><strong>{c.date}</strong>: {c.existing.map((b) => `${b.teacher_name}${b.class_name ? ' – ' + b.class_name : ''}`).join(', ')}</li>
                              ))}
                            </ul>
                            <p style={{ fontSize: '0.82rem', marginBottom: '0.5rem', color: 'var(--gray-700)' }}>Come procedere per le date in conflitto?</p>
                            <div className="request-card-actions">
                              <button className="btn btn-danger btn-sm" onClick={() => handleRecurringUpdateDates('force')} disabled={recurringModalLoading}>🔄 Sovrascrivi</button>
                              <button className="btn btn-primary btn-sm" onClick={() => handleRecurringUpdateDates('skip')} disabled={recurringModalLoading}>⏭️ Salta conflitti</button>
                              <button className="btn btn-secondary btn-sm" onClick={() => setRecurringEditConflicts(null)} disabled={recurringModalLoading}>Annulla</button>
                            </div>
                          </div>
                        )}
                        {!recurringEditConflicts && (
                          <div className="request-card-actions">
                            <button className="btn btn-primary btn-sm" onClick={() => handleRecurringUpdateDates()} disabled={recurringModalLoading}>💾 Salva</button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => { setShowRecurringEditDates(false); setRecurringEditStartDate(recurringRequest.start_date); setRecurringEditEndDate(recurringRequest.end_date) }}
                              disabled={recurringModalLoading}
                            >
                              Annulla
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {recurringRequest.status === 'cancelled' && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--gray-700)', marginTop: '0.5rem' }}>
                    Questa richiesta ricorrente è stata annullata.
                  </p>
                )}

                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--gray-200)', paddingTop: '0.75rem' }}>
                  <Link
                    to="/admin/recurring"
                    style={{ fontSize: '0.82rem', color: 'var(--primary)' }}
                    onClick={handleCloseRecurringModal}
                  >
                    → Vai alla gestione richieste ricorrenti
                  </Link>
                </div>
              </>
            ) : recurringModalError ? (
              <div className="error-msg">⚠️ {recurringModalError}</div>
            ) : null}
          </div>
        </div>
      )}

      {/* Add/Edit booking modal */}
      {bookingModal && (
        <div className="modal-overlay" onClick={handleCloseBookingModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{bookingModal.mode === 'edit' && bookingModal.booking?.source === 'recurring' ? '✏️ Sovrascivi occorrenza' : bookingModal.mode === 'edit' ? '✏️ Modifica prenotazione' : '✚ Nuova prenotazione'}</h3>
              <button className="modal-close" onClick={handleCloseBookingModal}>✕</button>
            </div>

            {bookingModal.mode === 'edit' && bookingModal.booking?.source === 'recurring' && (
              <p style={{ fontSize: '0.82rem', color: 'var(--gray-700)', marginBottom: '0.75rem', background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-sm)', padding: '0.6rem' }}>
                ℹ️ Stai sovrascrivendo una singola occorrenza della serie ricorrente. Le modifiche si applicheranno <strong>solo a questa data</strong>; le altre occorrenze non saranno influenzate.
              </p>
            )}

            {bookingModalError && (
              <div className="error-msg" style={{ marginBottom: '0.75rem' }}>⚠️ {bookingModalError}</div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); handleBookingModalSubmit() }}>
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label>Docente *</label>
                <input
                  type="text"
                  value={bookingForm.teacher_name}
                  onChange={(e) => setBookingForm((f) => ({ ...f, teacher_name: e.target.value }))}
                  placeholder="Es. Prof. Rossi"
                  required
                  autoFocus
                />
              </div>
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label>Classe</label>
                <input
                  type="text"
                  value={bookingForm.class_name}
                  onChange={(e) => setBookingForm((f) => ({ ...f, class_name: e.target.value }))}
                  placeholder="Es. 3A"
                />
              </div>

              {bookingModal.mode === 'add' && (
                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label>Tipo</label>
                  <select
                    value={bookingForm.booking_type}
                    onChange={(e) => setBookingForm((f) => ({ ...f, booking_type: e.target.value }))}
                  >
                    <option value="single">Singola ({bookingModal.date})</option>
                    <option value="recurring">Ricorrente</option>
                  </select>
                </div>
              )}

              {bookingModal.mode === 'add' && bookingForm.booking_type === 'recurring' && (
                <>
                  <div className="form-row" style={{ marginBottom: '0.75rem' }}>
                    <div className="form-group">
                      <label>Data inizio *</label>
                      <input
                        type="date"
                        value={bookingForm.start_date}
                        onChange={(e) => setBookingForm((f) => ({ ...f, start_date: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Data fine *</label>
                      <input
                        type="date"
                        value={bookingForm.end_date}
                        min={bookingForm.start_date}
                        onChange={(e) => setBookingForm((f) => ({ ...f, end_date: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                    <label>Giorni della settimana *</label>
                    <div className="checkbox-group">
                      {DAY_NAMES.map((name, i) => {
                        const val = i + 1
                        return (
                          <label key={val} className="checkbox-item">
                            <input
                              type="checkbox"
                              checked={bookingForm.weekdays.includes(val)}
                              onChange={() => setBookingForm((f) => ({
                                ...f,
                                weekdays: f.weekdays.includes(val)
                                  ? f.weekdays.filter((d) => d !== val)
                                  : [...f.weekdays, val],
                              }))}
                            />
                            {name}
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  {bookingModalConflicts && (
                    <div style={{ marginBottom: '0.75rem', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 'var(--radius-sm)', padding: '0.75rem' }}>
                      <p style={{ fontWeight: 600, marginBottom: '0.4rem', fontSize: '0.9rem' }}>⚠️ Le seguenti date hanno lo slot esaurito:</p>
                      <ul style={{ margin: '0 0 0.6rem 1.1rem', fontSize: '0.82rem', color: 'var(--gray-900)' }}>
                        {bookingModalConflicts.map((c) => (
                           <li key={c.date}><strong>{c.date}</strong>: {c.existing.map((b) => `${b.teacher_name}${b.class_name ? ' – ' + b.class_name : ''}`).join(', ')}</li>
                        ))}
                      </ul>
                      <p style={{ fontSize: '0.82rem', marginBottom: '0.5rem', color: 'var(--gray-700)' }}>Come procedere per le date in conflitto?</p>
                      <div className="request-card-actions">
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => handleBookingModalSubmit('force')} disabled={bookingModalLoading}>🔄 Sovrascrivi</button>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => handleBookingModalSubmit('skip')} disabled={bookingModalLoading}>⏭️ Salta conflitti</button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setBookingModalConflicts(null)} disabled={bookingModalLoading}>Annulla</button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {!bookingModalConflicts && (
                <div className="request-card-actions">
                  <button type="submit" className="btn btn-primary btn-sm" disabled={bookingModalLoading}>
                    {bookingModalLoading ? '...' : bookingModal.mode === 'edit' ? '💾 Salva' : '✚ Aggiungi'}
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleCloseBookingModal} disabled={bookingModalLoading}>
                    Annulla
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Mass edit floating action bar */}
      {massEditMode && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: selectedSlots.length > 0 ? 'var(--primary)' : 'var(--gray-700)',
          color: 'white',
          padding: '0.6rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 150,
          boxShadow: '0 -2px 8px rgba(0,0,0,0.2)',
          gap: '0.75rem',
          flexWrap: 'wrap',
        }}>
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
            {selectedSlots.length === 0
              ? '☑️ Modalità selezione multipla — clicca sugli slot disponibili'
              : `☑️ ${selectedSlots.length} slot selezionati`}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {selectedSlots.length > 0 && (
              <>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSelectedSlots([])}
                  style={{ fontSize: '0.8rem' }}
                >
                  Deseleziona tutto
                </button>
                <button
                  className="btn btn-sm"
                  onClick={handleOpenMassModal}
                  style={{ background: 'white', color: 'var(--primary)', fontWeight: 600, fontSize: '0.8rem' }}
                >
                  ✚ Crea prenotazione
                </button>
              </>
            )}
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleExitMassEdit}
              style={{ fontSize: '0.8rem' }}
            >
              ✕ Esci
            </button>
          </div>
        </div>
      )}

      {/* Mass booking modal */}
      {massModal && (
        <div className="modal-overlay" onClick={handleCloseMassModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--primary)' }}>✚ Nuova prenotazione multipla ({selectedSlots.length} slot)</h3>
              <button className="modal-close" onClick={handleCloseMassModal}>✕</button>
            </div>

            {/* Selected slots summary */}
            <div style={{ marginBottom: '0.75rem', background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-sm)', padding: '0.6rem', maxHeight: '9rem', overflowY: 'auto' }}>
              <p style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.35rem' }}>Slot selezionati:</p>
              {selectedSlots.map((s) => (
                <div key={`${s.slotId}__${s.date}`} style={{ fontSize: '0.75rem', color: 'var(--gray-700)', marginBottom: '2px' }}>
                  📅 {s.date} — ⏰ {s.slot?.start_time}–{s.slot?.end_time}{s.slot?.label ? ` (${s.slot.label})` : ''}
                </div>
              ))}
            </div>

            {massError && <div className="error-msg" style={{ marginBottom: '0.75rem' }}>⚠️ {massError}</div>}

            <form onSubmit={(e) => { e.preventDefault(); handleMassSubmit() }}>
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label>Docente *</label>
                <input
                  type="text"
                  value={massForm.teacher_name}
                  onChange={(e) => setMassForm((f) => ({ ...f, teacher_name: e.target.value }))}
                  placeholder="Es. Prof. Rossi"
                  required
                  autoFocus
                />
              </div>
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label>Classe</label>
                <input
                  type="text"
                  value={massForm.class_name}
                  onChange={(e) => setMassForm((f) => ({ ...f, class_name: e.target.value }))}
                  placeholder="Es. 3A"
                />
              </div>
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label>Tipo</label>
                <select
                  value={massForm.booking_type}
                  onChange={(e) => setMassForm((f) => ({ ...f, booking_type: e.target.value }))}
                >
                  <option value="single">Singola (per ogni data selezionata)</option>
                  <option value="recurring">Ricorrente</option>
                </select>
              </div>

              {massForm.booking_type === 'recurring' && (
                <>
                  <div className="form-row" style={{ marginBottom: '0.75rem' }}>
                    <div className="form-group">
                      <label>Data inizio *</label>
                      <input
                        type="date"
                        value={massForm.start_date}
                        onChange={(e) => setMassForm((f) => ({ ...f, start_date: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Data fine *</label>
                      <input
                        type="date"
                        value={massForm.end_date}
                        min={massForm.start_date}
                        onChange={(e) => setMassForm((f) => ({ ...f, end_date: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                    <label>Giorni della settimana *</label>
                    <div className="checkbox-group">
                      {DAY_NAMES.map((name, i) => {
                        const val = i + 1
                        return (
                          <label key={val} className="checkbox-item">
                            <input
                              type="checkbox"
                              checked={massForm.weekdays.includes(val)}
                              onChange={() => setMassForm((f) => ({
                                ...f,
                                weekdays: f.weekdays.includes(val)
                                  ? f.weekdays.filter((d) => d !== val)
                                  : [...f.weekdays, val],
                              }))}
                            />
                            {name}
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  {massConflicts && (
                    <div style={{ marginBottom: '0.75rem', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 'var(--radius-sm)', padding: '0.75rem' }}>
                      <p style={{ fontWeight: 600, marginBottom: '0.4rem', fontSize: '0.9rem' }}>⚠️ Le seguenti date hanno lo slot esaurito:</p>
                      <ul style={{ margin: '0 0 0.6rem 1.1rem', fontSize: '0.82rem', color: 'var(--gray-900)' }}>
                        {massConflicts.map((c, idx) => (
                          <li key={idx}><strong>{c.date}</strong>: {c.existing?.map((b) => `${b.teacher_name}${b.class_name ? ' – ' + b.class_name : ''}`).join(', ')}</li>
                        ))}
                      </ul>
                      <p style={{ fontSize: '0.82rem', marginBottom: '0.5rem', color: 'var(--gray-700)' }}>Come procedere per le date in conflitto?</p>
                      <div className="request-card-actions">
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => handleMassSubmit('force')} disabled={massLoading}>🔄 Sovrascrivi</button>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => handleMassSubmit('skip')} disabled={massLoading}>⏭️ Salta conflitti</button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMassConflicts(null)} disabled={massLoading}>Annulla</button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {!massConflicts && (
                <div className="request-card-actions">
                  <button type="submit" className="btn btn-primary btn-sm" disabled={massLoading}>
                    {massLoading ? '...' : `✚ Crea ${selectedSlots.length} prenotazion${selectedSlots.length === 1 ? 'e' : 'i'}`}
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleCloseMassModal} disabled={massLoading}>
                    Annulla
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  )
}

