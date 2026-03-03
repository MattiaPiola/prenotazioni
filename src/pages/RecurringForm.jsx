import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getRoomSlots, createRecurringRequest } from '../lib/api.js'
import { DAY_NAMES, formatDate } from '../lib/dates.js'

function createEntry(defaultSlotId = '') {
  return { slotId: defaultSlotId, startDate: '', endDate: '', weekdays: [] }
}

export default function RecurringForm() {
  const { roomId } = useParams()

  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const [teacherName, setTeacherName] = useState('')
  const [className, setClassName] = useState('')
  const [entries, setEntries] = useState([createEntry()])

  useEffect(() => {
    getRoomSlots(roomId)
      .then((s) => {
        setSlots(s)
        if (s.length > 0) {
          setEntries([createEntry(s[0].id)])
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [roomId])

  const updateEntry = (index, field, value) => {
    setEntries((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry))
    )
  }

  const toggleWeekday = (index, day) => {
    setEntries((prev) =>
      prev.map((entry, i) => {
        if (i !== index) return entry
        const weekdays = entry.weekdays.includes(day)
          ? entry.weekdays.filter((d) => d !== day)
          : [...entry.weekdays, day]
        return { ...entry, weekdays }
      })
    )
  }

  const addEntry = () => {
    setEntries((prev) => [...prev, createEntry(slots.length > 0 ? slots[0].id : '')])
  }

  const removeEntry = (index) => {
    setEntries((prev) => prev.filter((_, i) => i !== index))
  }

  const today = formatDate(new Date())
  const nextYear = formatDate(new Date(new Date().setFullYear(new Date().getFullYear() + 1)))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    for (let i = 0; i < entries.length; i++) {
      const { slotId, startDate, endDate, weekdays } = entries[i]
      const label = entries.length > 1 ? ` (richiesta ${i + 1})` : ''

      if (weekdays.length === 0) {
        setError(`Seleziona almeno un giorno della settimana${label}.`)
        return
      }

      const start = new Date(startDate)
      const end = new Date(endDate)
      if (end < start) {
        setError(`La data di fine deve essere successiva alla data di inizio${label}.`)
        return
      }
      const diffDays = (end - start) / (1000 * 60 * 60 * 24)
      if (diffDays > 365) {
        setError(`Il periodo non può superare un anno scolastico (365 giorni)${label}.`)
        return
      }
    }

    setSubmitting(true)
    try {
      for (let i = 0; i < entries.length; i++) {
        const { slotId, startDate, endDate, weekdays } = entries[i]
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
        } catch (err) {
          const label = entries.length > 1 ? ` (richiesta ${i + 1} di ${entries.length})` : ''
          throw new Error(`${err.message}${label}`)
        }
      }
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
            <h2 style={{ marginBottom: '0.5rem' }}>
              {entries.length > 1 ? 'Richieste inviate!' : 'Richiesta inviata!'}
            </h2>
            <p style={{ color: 'var(--gray-700)', marginBottom: '1.5rem' }}>
              {entries.length > 1
                ? `Le tue ${entries.length} richieste di prenotazione ricorrente sono state inviate e verranno elaborate dall'amministratore.`
                : "La tua richiesta di prenotazione ricorrente è stata inviata e verrà elaborata dall'amministratore."}
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
              Compila il modulo per richiedere una o più prenotazioni ricorrenti. Le richieste verranno approvate dall'amministratore.
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
              </div>

              {entries.map((entry, index) => (
                <div className="card" key={index}>
                  <div className="card-header">
                    <h2 className="card-title">
                      {entries.length > 1 ? `Richiesta ${index + 1}` : 'Dettagli Richiesta'}
                    </h2>
                    {entries.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => removeEntry(index)}
                      >
                        Rimuovi
                      </button>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor={`slot-${index}`}>Orario *</label>
                    <select
                      id={`slot-${index}`}
                      value={entry.slotId}
                      onChange={(e) => updateEntry(index, 'slotId', e.target.value)}
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
                      <label htmlFor={`start-${index}`}>Data inizio *</label>
                      <input
                        id={`start-${index}`}
                        type="date"
                        value={entry.startDate}
                        min={today}
                        max={nextYear}
                        onChange={(e) => updateEntry(index, 'startDate', e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor={`end-${index}`}>Data fine *</label>
                      <input
                        id={`end-${index}`}
                        type="date"
                        value={entry.endDate}
                        min={entry.startDate || today}
                        max={nextYear}
                        onChange={(e) => updateEntry(index, 'endDate', e.target.value)}
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
                              checked={entry.weekdays.includes(val)}
                              onChange={() => toggleWeekday(index, val)}
                            />
                            {name}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ))}

              <div style={{ marginBottom: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={addEntry}
                >
                  + Aggiungi un'altra richiesta
                </button>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
                  {submitting ? 'Invio...' : entries.length > 1 ? `📋 Invia ${entries.length} richieste` : '📋 Invia richiesta'}
                </button>
                <Link to={`/week/${roomId}`} className="btn btn-secondary btn-lg">
                  Annulla
                </Link>
              </div>
            </form>
          </>
        )}
      </div>
    </>
  )
}
