import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { getRoomSlots, getRoomBookings, getRooms, getRoomBlockedSlots, cancelBooking } from '../lib/api.js'
import { getWeekDates, formatDate, formatDisplayDate, DAY_NAMES } from '../lib/dates.js'

export default function WeekView() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const weekOffset = parseInt(searchParams.get('week') || '0', 10)

  const [room, setRoom] = useState(null)
  const [slots, setSlots] = useState([])
  const [bookings, setBookings] = useState([])
  const [blockedSlots, setBlockedSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const weekDates = getWeekDates(weekOffset)
  const dateFrom = formatDate(weekDates[0])
  const dateTo = formatDate(weekDates[6])

  const load = () => {
    setLoading(true)
    setError(null)
    Promise.all([
      getRooms().then((rooms) => rooms.find((r) => r.id === roomId)),
      getRoomSlots(roomId),
      getRoomBookings(roomId, dateFrom, dateTo),
      getRoomBlockedSlots(roomId, dateFrom, dateTo),
    ])
      .then(([roomData, slotsData, bookingsData, blockedData]) => {
        setRoom(roomData || null)
        setSlots(slotsData)
        setBookings(bookingsData)
        setBlockedSlots(blockedData)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [roomId, dateFrom, dateTo])

  const getBookingsForSlot = (slotId, date) =>
    bookings.filter((b) => b.room_slot_id === slotId && b.date === date)

  const isBlocked = (slotId, date) =>
    blockedSlots.some((b) => b.room_slot_id === slotId && b.date === date)

  const handleWeekChange = (offset) => {
    if (offset < 0 || offset > 1) return
    setSearchParams({ week: offset })
  }

  const handleCancelBooking = async (bookingId) => {
    if (!confirm('Vuoi cancellare questa prenotazione?')) return
    try {
      await cancelBooking(bookingId)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const weekLabel = `${formatDisplayDate(weekDates[0])} – ${formatDisplayDate(weekDates[6])}`

  // Determine which day columns to show
  const visibleWeekdays = room?.visible_weekdays ?? [0, 1, 2, 3, 4]
  const visibleDayIndices = weekDates
    .map((_, i) => i)
    .filter((i) => visibleWeekdays.includes(i))

  return (
    <>
      <nav className="nav">
        <Link to="/" className="nav-back">← Indietro</Link>
        <span className="nav-title">{room ? room.name : 'Caricamento...'}</span>
      </nav>

      <div className="page-wide">
        {loading && (
          <div className="loading">
            <div className="spinner" />
            <span>Caricamento...</span>
          </div>
        )}

        {error && <div className="error-msg">⚠️ {error}</div>}

        {!loading && !error && (
          <>
            {/* Public announcement */}
            {room?.announcement && (
              <div
                className="card"
                style={{
                  marginBottom: '1rem',
                  background: '#fffbeb',
                  borderLeft: '4px solid #f59e0b',
                  padding: '0.75rem 1rem',
                }}
              >
                <strong>📢 Avviso:</strong> {room.announcement}
              </div>
            )}

            <div className="week-nav">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleWeekChange(0)}
                disabled={weekOffset === 0}
              >
                ← Settimana corrente
              </button>
              <span className="week-nav-label">📅 {weekLabel}</span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleWeekChange(1)}
                disabled={weekOffset === 1}
              >
                Prossima settimana →
              </button>
            </div>

            {slots.length === 0 ? (
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
                  {slots.map((slot) => {
                    const maxBookings = slot.max_bookings || 1
                    return (
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
                          </div>
                        </div>
                        {visibleDayIndices.map((dayIdx) => {
                          const dateStr = formatDate(weekDates[dayIdx])
                          const slotBookings = getBookingsForSlot(slot.id, dateStr)
                          const blocked = isBlocked(slot.id, dateStr)
                          const isFull = slotBookings.length >= maxBookings
                          const allRecurring = slotBookings.length > 0 && slotBookings.every((b) => b.source === 'recurring')

                          if (blocked) {
                            return (
                              <div key={dayIdx} className="slot-cell slot-weekend">
                                <div style={{ fontSize: '0.75rem', color: 'var(--gray-700)' }}>🔒 Non disponibile</div>
                              </div>
                            )
                          }

                          return (
                            <div
                              key={dayIdx}
                              className={`slot-cell ${allRecurring ? 'slot-recurring' : isFull ? 'slot-booked' : slotBookings.length > 0 ? 'slot-partial' : 'slot-available'}`}
                            >
                              {slotBookings.length > 0 && (
                                <div className="slot-booked-info">
                                  {slotBookings.map((b) => (
                                    <div key={b.id} style={{ marginBottom: '4px' }}>
                                      <div className="slot-booked-teacher">
                                        {b.source === 'recurring' && '🔁 '}{b.teacher_name}
                                      </div>
                                      <div className="slot-booked-class">{b.class_name}</div>
                                      {room?.allow_user_edit && (
                                        <button
                                          onClick={() => handleCancelBooking(b.id)}
                                          style={{
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            color: 'var(--danger)', fontSize: '0.7rem', padding: '1px 0',
                                          }}
                                        >
                                          ✕ Cancella
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                  {maxBookings > 1 && (
                                    <div style={{ fontSize: '0.7rem', color: 'var(--gray-700)', marginTop: '2px' }}>
                                      {slotBookings.length}/{maxBookings} prenotaz.
                                    </div>
                                  )}
                                </div>
                              )}
                              {!isFull && (
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() =>
                                    navigate(
                                      `/room/${roomId}/book?date=${dateStr}&slotId=${slot.id}`
                                    )
                                  }
                                >
                                  Prenota
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Link to={`/room/${roomId}/recurring`} className="btn btn-outline">
                🔁 Richiedi prenotazione ricorrente
              </Link>
            </div>

            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.78rem', color: 'var(--gray-700)' }}>
              <span style={{ fontWeight: 600 }}>Legenda:</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ width: '12px', height: '12px', background: 'var(--primary-light)', borderRadius: '2px', display: 'inline-block', border: '1px solid var(--gray-300)' }} />
                Prenotato
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ width: '12px', height: '12px', background: '#fef9c3', borderRadius: '2px', display: 'inline-block', border: '1px solid var(--gray-300)' }} />
                Parzialmente prenotato
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ width: '12px', height: '12px', background: 'var(--recurring-light)', borderRadius: '2px', display: 'inline-block', border: '1px solid var(--gray-300)' }} />
                🔁 Prenotazione ricorrente
              </span>
            </div>
          </>
        )}
      </div>
    </>
  )
}
