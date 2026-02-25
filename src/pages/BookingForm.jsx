import { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom'
import { getRoomSlots, createBooking } from '../lib/api.js'
import { formatDisplayDate, getWeekDates } from '../lib/dates.js'

export default function BookingForm() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const date = searchParams.get('date') || ''
  const slotId = searchParams.get('slotId') || ''

  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const [teacherName, setTeacherName] = useState('')
  const [className, setClassName] = useState('')

  useEffect(() => {
    getRoomSlots(roomId)
      .then(setSlots)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [roomId])

  const slot = slots.find((s) => s.id === slotId)

  const displayDate = date
    ? (() => {
        const [y, m, d] = date.split('-').map(Number)
        return formatDisplayDate(new Date(y, m - 1, d))
      })()
    : ''

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await createBooking({
        room_id: roomId,
        room_slot_id: slotId,
        date,
        teacher_name: teacherName.trim(),
        class_name: className.trim(),
      })
      setSuccess(true)
    } catch (err) {
      if (err.status === 409) {
        setError('Questo slot è già stato prenotato. Scegli un altro orario.')
      } else {
        setError(err.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <>
        <nav className="nav">
          <Link to={`/week/${roomId}`} className="nav-back">← Calendario</Link>
          <span className="nav-title">Prenotazione effettuata</span>
        </nav>
        <div className="page">
          <div className="success-page">
            <div className="success-icon">✅</div>
            <h2 style={{ marginBottom: '0.5rem' }}>Prenotazione confermata!</h2>
            <p style={{ color: 'var(--gray-700)', marginBottom: '1.5rem' }}>
              {displayDate} · {slot ? `${slot.start_time} – ${slot.end_time}` : ''}<br />
              {teacherName} · {className}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to={`/week/${roomId}`} className="btn btn-primary">
                ← Torna al calendario
              </Link>
              <Link to="/" className="btn btn-secondary">
                Home
              </Link>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <nav className="nav">
        <Link to={`/week/${roomId}`} className="nav-back">← Calendario</Link>
        <span className="nav-title">Nuova Prenotazione</span>
      </nav>

      <div className="page">
        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : (
          <>
            <div className="card" style={{ marginBottom: '1.5rem', background: 'var(--primary-light)' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--primary-dark)' }}>
                <strong>📅 Data:</strong> {displayDate}
              </div>
              {slot && (
                <div style={{ fontSize: '0.875rem', color: 'var(--primary-dark)', marginTop: '0.35rem' }}>
                  <strong>⏰ Orario:</strong> {slot.start_time} – {slot.end_time}
                  {slot.label && ` (${slot.label})`}
                </div>
              )}
            </div>

            {error && <div className="error-msg">⚠️ {error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="card">
                <h2 style={{ marginBottom: '1rem' }}>Dati Prenotazione</h2>

                <div className="form-group">
                  <label htmlFor="teacher">Nome del docente *</label>
                  <input
                    id="teacher"
                    type="text"
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                    placeholder="Es. Prof. Rossi"
                    required
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="class">Classe *</label>
                  <input
                    id="class"
                    type="text"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    placeholder="Es. 3A"
                    required
                  />
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
                    {submitting ? 'Invio...' : '✅ Conferma prenotazione'}
                  </button>
                  <Link to={`/week/${roomId}`} className="btn btn-secondary btn-lg">
                    Annulla
                  </Link>
                </div>
              </div>
            </form>
          </>
        )}
      </div>
    </>
  )
}
