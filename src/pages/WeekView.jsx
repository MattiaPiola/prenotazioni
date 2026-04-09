import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { getRoomSlots, getRoomBookings, getRooms, getRoomBlockedSlots, cancelBooking, createBooking } from '../lib/api.js'
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

  // Mass select state
  const [massSelectMode, setMassSelectMode] = useState(false)
  const [selectedSlots, setSelectedSlots] = useState([])
  const [massModal, setMassModal] = useState(false)
  const [massForm, setMassForm] = useState({ teacher_name: '', class_name: '' })
  const [massLoading, setMassLoading] = useState(false)
  const [massError, setMassError] = useState(null)
  const [massSuccess, setMassSuccess] = useState(null)

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

  const getBlockedSlot = (slotId, date) =>
    blockedSlots.find((b) => b.room_slot_id === slotId && b.date === date)

  const handleWeekChange = (offset) => {
    const maxOffset = room?.booking_weeks_ahead ?? 1
    if (offset < 0 || offset > maxOffset) return
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

  // Mass select helpers
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

  const handleEnterMassSelect = () => {
    setMassSelectMode(true)
    setSelectedSlots([])
  }

  const handleExitMassSelect = () => {
    setMassSelectMode(false)
    setSelectedSlots([])
    setMassModal(false)
    setMassError(null)
    setMassSuccess(null)
  }

  const handleOpenMassModal = () => {
    setMassForm({ teacher_name: '', class_name: '' })
    setMassError(null)
    setMassSuccess(null)
    setMassModal(true)
  }

  const handleCloseMassModal = () => {
    setMassModal(false)
    setMassError(null)
    setMassSuccess(null)
  }

  const handleMassSubmit = async (e) => {
    e.preventDefault()
    setMassLoading(true)
    setMassError(null)
    setMassSuccess(null)
    const errors = []
    for (const s of selectedSlots) {
      try {
        await createBooking({
          room_id: roomId,
          room_slot_id: s.slotId,
          date: s.date,
          teacher_name: massForm.teacher_name.trim(),
          class_name: massForm.class_name.trim() || null,
        })
      } catch (err) {
        errors.push(`${s.date} ${s.slot?.start_time ?? ''}: ${err.status === 409 ? 'slot già prenotato' : err.message}`)
      }
    }
    setMassLoading(false)
    if (errors.length > 0) {
      setMassError(`Alcune prenotazioni non sono state create:\n${errors.join('\n')}`)
    } else {
      setMassSuccess(`✅ ${selectedSlots.length} prenotazion${selectedSlots.length === 1 ? 'e creata' : 'i create'} con successo!`)
    }
    load()
    setSelectedSlots([])
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
                onClick={() => handleWeekChange(weekOffset - 1)}
                disabled={weekOffset === 0}
              >
                ← Settimana precedente
              </button>
              <span className="week-nav-label">📅 {weekLabel}</span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleWeekChange(weekOffset + 1)}
                disabled={weekOffset >= (room?.booking_weeks_ahead ?? 1)}
              >
                Settimana successiva →
              </button>
            </div>

            <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {massSelectMode ? (
                <button className="btn btn-secondary btn-sm" onClick={handleExitMassSelect}>
                  ✕ Esci selezione multipla
                </button>
              ) : (
                <button className="btn btn-secondary btn-sm" onClick={handleEnterMassSelect}>
                  ☑ Selezione multipla
                </button>
              )}
              {massSelectMode && (
                <span style={{ fontSize: '0.82rem', color: 'var(--gray-700)' }}>
                  ☑️ Modalità selezione multipla attiva. Clicca sugli slot disponibili per selezionarli.
                </span>
              )}
            </div>

            {slots.length === 0 ? (
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
                          const blockedSlot = getBlockedSlot(slot.id, dateStr)
                          const isDisabledSlot = blockedSlot?.type === 'disabled'
                          const isLockedSlot = blockedSlot?.type === 'locked'
                          const isFull = slotBookings.length >= maxBookings
                          const allRecurring = slotBookings.length > 0 && slotBookings.every((b) => b.source === 'recurring')

                          if (isDisabledSlot) {
                            return (
                              <div key={dayIdx} className="slot-cell slot-weekend">
                                <div style={{ fontSize: '0.75rem', color: 'var(--gray-700)' }}>🚫 Non disponibile</div>
                              </div>
                            )
                          }

                          const isSelectable = massSelectMode && !isLockedSlot && !isFull
                          const isSelected = massSelectMode && isSlotSelected(slot.id, dateStr)

                          return (
                            <div
                              key={dayIdx}
                              className={`slot-cell ${
                                isSelected ? 'slot-selected' :
                                allRecurring ? 'slot-recurring' :
                                isFull || isLockedSlot ? 'slot-booked' :
                                slotBookings.length > 0 ? 'slot-partial' :
                                'slot-available'
                              }`}
                              style={isSelectable ? { cursor: 'pointer' } : undefined}
                              onClick={isSelectable ? () => handleToggleMassSelect(slot.id, dateStr) : undefined}
                            >
                              {massSelectMode ? (
                                isLockedSlot ? (
                                  <div style={{ fontSize: '0.72rem', color: 'var(--gray-700)', textAlign: 'center' }}>🔒 Bloccato</div>
                                ) : isSelected ? (
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
                              ) : (
                                <>
                                  {slotBookings.length > 0 && (
                                    <div className="slot-booked-info">
                                      {slotBookings.map((b) => (
                                        <div key={b.id} style={{ marginBottom: '4px' }}>
                                          <div className="slot-booked-teacher">
                                            {b.source === 'recurring' && '🔁 '}{b.teacher_name}
                                          </div>
                                          <div className="slot-booked-class">{b.class_name}</div>
                                          {room?.allow_user_edit && b.source !== 'recurring' && !isLockedSlot && (
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
                                  {isLockedSlot ? (
                                    <div style={{ fontSize: '0.72rem', color: 'var(--gray-700)', marginTop: slotBookings.length > 0 ? '4px' : 0 }}>🔒 Bloccato</div>
                                  ) : (
                                    !isFull && (
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
                                    )
                                  )}
                                </>
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
              <span>🔒 Bloccato (modifiche non consentite)</span>
              <span>🚫 Non disponibile</span>
            </div>
          </>
        )}
      </div>

      {/* Mass select floating action bar */}
      {massSelectMode && (
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
              : `☑️ ${selectedSlots.length} slot selezionat${selectedSlots.length === 1 ? 'o' : 'i'}`}
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
                  ✚ Prenota selezionati
                </button>
              </>
            )}
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleExitMassSelect}
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
              <h3 style={{ color: 'var(--primary)' }}>✚ Prenotazione multipla ({selectedSlots.length} slot)</h3>
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

            {massError && (
              <div className="error-msg" style={{ marginBottom: '0.75rem', whiteSpace: 'pre-line' }}>⚠️ {massError}</div>
            )}
            {massSuccess && (
              <div className="success-msg" style={{ marginBottom: '0.75rem' }}>{massSuccess}</div>
            )}

            {!massSuccess && (
              <form onSubmit={handleMassSubmit}>
                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label>Nome del docente *</label>
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
                <div className="request-card-actions">
                  <button type="submit" className="btn btn-primary btn-sm" disabled={massLoading}>
                    {massLoading ? '...' : `✅ Conferma ${selectedSlots.length} prenotazion${selectedSlots.length === 1 ? 'e' : 'i'}`}
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleCloseMassModal} disabled={massLoading}>
                    Annulla
                  </button>
                </div>
              </form>
            )}

            {massSuccess && (
              <div className="request-card-actions">
                <button className="btn btn-primary btn-sm" onClick={() => { handleCloseMassModal(); handleExitMassSelect() }}>
                  Chiudi
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
