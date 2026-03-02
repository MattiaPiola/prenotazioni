import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  adminGetRooms,
  adminGetSlots,
  adminGetBookings,
  adminCancelBooking,
  adminGetBlockedSlots,
  adminBlockSlot,
  adminUnblockSlot,
} from '../lib/api.js'
import { getWeekDates, formatDate, formatDisplayDate, DAY_NAMES } from '../lib/dates.js'

export default function AdminCalendar() {
  const [rooms, setRooms] = useState([])
  const [selectedRoom, setSelectedRoom] = useState('')
  const [slots, setSlots] = useState([])
  const [bookings, setBookings] = useState([])
  const [blocked, setBlocked] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [weekOffset, setWeekOffset] = useState(0)

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

  const handleToggleBlock = async (slotId, date) => {
    const existingBlock = getBlock(slotId, date)
    try {
      if (existingBlock) {
        await adminUnblockSlot(existingBlock.id)
      } else {
        await adminBlockSlot({ room_id: selectedRoom, room_slot_id: slotId, date })
      }
      reload()
    } catch (err) {
      setError(err.message)
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
            <label>Aula</label>
            <select value={selectedRoom} onChange={(e) => setSelectedRoom(e.target.value)}>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
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
          💡 Clicca su uno slot libero/bloccato per bloccare/sbloccare. Clicca su una prenotazione per cancellarla.
        </p>

        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : slots.length === 0 ? (
          <div className="empty-state">Nessun orario configurato per questa aula.</div>
        ) : (
          <div className="week-grid-wrapper">
            <div className="week-grid">
              {/* Header */}
              <div
                className="week-grid-header"
                style={{ gridTemplateColumns: `100px repeat(${visibleDayIndices.length}, 1fr)` }}
              >
                <div className="week-grid-header-cell">Ora</div>
                {visibleDayIndices.map((i) => (
                  <div key={i} className="week-grid-header-cell">
                    <div>{DAY_NAMES[i].slice(0, 3)}</div>
                    <div style={{ fontWeight: 400, opacity: 0.85, fontSize: '0.72rem' }}>
                      {weekDates[i].getDate()}/{weekDates[i].getMonth() + 1}
                    </div>
                  </div>
                ))}
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
                    const isBlocked = !!block
                    const maxBookings = slot.max_bookings || 1
                    const isFull = !isBlocked && slotBookings.length >= maxBookings

                    return (
                      <div
                        key={dayIdx}
                        className={`slot-cell ${isBlocked ? 'slot-weekend' : slotBookings.length > 0 ? (isFull ? 'slot-booked' : 'slot-partial') : 'slot-available'}`}
                        style={{ padding: '0.4rem', verticalAlign: 'top', minHeight: '3.5rem' }}
                      >
                        {isBlocked ? (
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--gray-700)', marginBottom: '0.3rem' }}>
                              🔒 Bloccato
                            </div>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                              onClick={() => handleToggleBlock(slot.id, dateStr)}
                            >
                              Sblocca
                            </button>
                          </div>
                        ) : (
                          <div>
                            {slotBookings.map((b) => (
                              <div
                                key={b.id}
                                style={{
                                  background: 'var(--primary-light)',
                                  borderRadius: '4px',
                                  padding: '2px 5px',
                                  marginBottom: '3px',
                                  fontSize: '0.72rem',
                                }}
                              >
                                <div style={{ fontWeight: 600 }}>{b.teacher_name}</div>
                                <div style={{ opacity: 0.8 }}>{b.class_name}</div>
                                <button
                                  onClick={() => handleCancelBooking(b.id)}
                                  style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'var(--danger)', fontSize: '0.65rem', padding: '1px 0',
                                  }}
                                >
                                  🗑️ Annulla
                                </button>
                              </div>
                            ))}
                            {maxBookings > 1 && (
                              <div style={{ fontSize: '0.65rem', color: 'var(--gray-700)', marginBottom: '2px' }}>
                                {slotBookings.length}/{maxBookings}
                              </div>
                            )}
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '0.7rem', padding: '2px 6px', marginTop: '2px' }}
                              onClick={() => handleToggleBlock(slot.id, dateStr)}
                            >
                              🔒 Blocca
                            </button>
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
    </>
  )
}
