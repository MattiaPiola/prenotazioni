import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getRoomSlots, createRecurringRequest } from '../lib/api.js'
import { DAY_NAMES, formatDate } from '../lib/dates.js'

export default function RecurringForm() {
  const { roomId } = useParams()

  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const [teacherName, setTeacherName] = useState('')
  const [className, setClassName] = useState('')
  const [slotId, setSlotId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [weekdays, setWeekdays] = useState([])

  useEffect(() => {
    getRoomSlots(roomId)
      .then((s) => {
        setSlots(s)
        if (s.length > 0) setSlotId(s[0].id)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [roomId])

  const toggleWeekday = (day) => {
    setWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (weekdays.length === 0) {
      setError('Seleziona almeno un giorno della settimana.')
      return
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    if (end < start) {
      setError('La data di fine deve essere successiva alla data di inizio.')
      return
    }
    const diffDays = (end - start) / (1000 * 60 * 60 * 24)
    if (diffDays > 365) {
      setError('Il periodo non può superare un anno scolastico (365 giorni).')
      return
    }

    setSubmitting(true)
    try {
      await createRecurringRequest({
        room_id: roomId,
        room_slot_id: slotId,
        start_date: startDate,
        end_date: endDate,
        weekdays,
        teacher_name: teacherName.trim(),
        class_name: className.trim(),
      })
      setSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <>
        <nav className="nav">
          <Link to={`/week/${roomId}`} className="nav-back">← Calendario</Link>
          <span className="nav-title">Richiesta inviata</span>
        </nav>
        <div className="page">
          <div className="success-page">
            <div className="success-icon">📋</div>
            <h2 style={{ marginBottom: '0.5rem' }}>Richiesta inviata!</h2>
            <p style={{ color: 'var(--gray-700)', marginBottom: '1.5rem' }}>
              La tua richiesta di prenotazione ricorrente è stata inviata e verrà elaborata dall'amministratore.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to={`/week/${roomId}`} className="btn btn-primary">
                ← Torna al calendario
              </Link>
              <Link to="/" className="btn btn-secondary">Home</Link>
            </div>
          </div>
        </div>
      </>
    )
  }

  const today = formatDate(new Date())
  const nextYear = formatDate(new Date(new Date().setFullYear(new Date().getFullYear() + 1)))

  return (
    <>
      <nav className="nav">
        <Link to={`/week/${roomId}`} className="nav-back">← Calendario</Link>
        <span className="nav-title">Prenotazione Ricorrente</span>
      </nav>

      <div className="page">
        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : (
          <>
            <p style={{ color: 'var(--gray-700)', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
              Compila il modulo per richiedere una prenotazione ricorrente. La richiesta verrà approvata dall'amministratore.
            </p>

            {error && <div className="error-msg">⚠️ {error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="card">
                <h2 style={{ marginBottom: '1rem' }}>Dati Richiedente</h2>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="teacher">Nome del docente *</label>
                    <input
                      id="teacher"
                      type="text"
                      value={teacherName}
                      onChange={(e) => setTeacherName(e.target.value)}
                      placeholder="Es. Prof. Rossi"
                      required
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
                </div>

                <div className="form-group">
                  <label htmlFor="slot">Orario *</label>
                  <select
                    id="slot"
                    value={slotId}
                    onChange={(e) => setSlotId(e.target.value)}
                    required
                  >
                    {slots.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.start_time} – {s.end_time}{s.label ? ` (${s.label})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="start">Data inizio *</label>
                    <input
                      id="start"
                      type="date"
                      value={startDate}
                      min={today}
                      max={nextYear}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="end">Data fine *</label>
                    <input
                      id="end"
                      type="date"
                      value={endDate}
                      min={startDate || today}
                      max={nextYear}
                      onChange={(e) => setEndDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Giorni della settimana *</label>
                  <div className="checkbox-group">
                    {DAY_NAMES.map((name, i) => {
                      const val = i + 1
                      return (
                        <label key={val} className="checkbox-item">
                          <input
                            type="checkbox"
                            checked={weekdays.includes(val)}
                            onChange={() => toggleWeekday(val)}
                          />
                          {name}
                        </label>
                      )
                    })}
                  </div>
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
                    {submitting ? 'Invio...' : '📋 Invia richiesta'}
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
