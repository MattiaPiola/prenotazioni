import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { getRoomSlots, getRoomBookings, getRooms } from '../lib/api.js'
import { getWeekDates, formatDate, formatDisplayDate, DAY_NAMES } from '../lib/dates.js'

export default function WeekView() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const weekOffset = parseInt(searchParams.get('week') || '0', 10)

  const [room, setRoom] = useState(null)
  const [slots, setSlots] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const weekDates = getWeekDates(weekOffset)
  const dateFrom = formatDate(weekDates[0])
  const dateTo = formatDate(weekDates[6])

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      getRooms().then((rooms) => rooms.find((r) => r.id === roomId)),
      getRoomSlots(roomId),
      getRoomBookings(roomId, dateFrom, dateTo),
    ])
      .then(([roomData, slotsData, bookingsData]) => {
        setRoom(roomData || null)
        setSlots(slotsData)
        setBookings(bookingsData)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [roomId, dateFrom, dateTo])

  const getBooking = (slotId, date) =>
    bookings.find((b) => b.room_slot_id === slotId && b.date === date)

  const handleWeekChange = (offset) => {
    if (offset < 0 || offset > 1) return
    setSearchParams({ week: offset })
  }

  const weekLabel = `${formatDisplayDate(weekDates[0])} – ${formatDisplayDate(weekDates[6])}`

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
                  <div className="week-grid-header">
                    <div className="week-grid-header-cell">Ora</div>
                    {weekDates.map((date, i) => (
                      <div key={i} className="week-grid-header-cell">
                        <div>{DAY_NAMES[i].slice(0, 3)}</div>
                        <div style={{ fontWeight: 400, opacity: 0.85, fontSize: '0.72rem' }}>
                          {date.getDate()}/{date.getMonth() + 1}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Rows */}
                  {slots.map((slot) => (
                    <div key={slot.id} className="week-grid-row">
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
                      {weekDates.map((date, dayIdx) => {
                        const dateStr = formatDate(date)
                        const booking = getBooking(slot.id, dateStr)
                        const isWeekend = dayIdx >= 5
                        return (
                          <div
                            key={dayIdx}
                            className={`slot-cell ${booking ? 'slot-booked' : isWeekend ? 'slot-weekend' : 'slot-available'}`}
                          >
                            {booking ? (
                              <div className="slot-booked-info">
                                <div className="slot-booked-teacher">{booking.teacher_name}</div>
                                <div className="slot-booked-class">{booking.class_name}</div>
                              </div>
                            ) : !isWeekend ? (
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
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Link to={`/room/${roomId}/recurring`} className="btn btn-outline">
                🔁 Richiedi prenotazione ricorrente
              </Link>
            </div>
          </>
        )}
      </div>
    </>
  )
}
