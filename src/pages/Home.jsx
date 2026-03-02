import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getRooms } from '../lib/api.js'
import { getWeekDates, formatDisplayDate } from '../lib/dates.js'

export default function Home() {
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getRooms()
      .then(setRooms)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const weekDates = getWeekDates(0)
  const weekLabel = `${formatDisplayDate(weekDates[0])} – ${formatDisplayDate(weekDates[6])}`

  return (
    <>
      <nav className="nav">
        <span className="nav-brand">🖥️ Prenotazioni Aule</span>
        <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)' }}>
          {weekLabel}
        </span>
      </nav>

      <div className="page">
        <h1 style={{ marginBottom: '0.25rem' }}>Aule Informatica</h1>
        <p style={{ color: 'var(--gray-700)', marginBottom: '0.25rem', fontSize: '0.95rem' }}>
          Seleziona un'aula per visualizzare e gestire le prenotazioni.
        </p>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.82rem', marginBottom: '1.5rem' }}>
          Settimana corrente: {weekLabel}
        </p>

        {loading && (
          <div className="loading">
            <div className="spinner" />
            <span>Caricamento aule...</span>
          </div>
        )}

        {error && <div className="error-msg">⚠️ {error}</div>}

        {!loading && !error && rooms.length === 0 && (
          <div className="empty-state">Nessuna aula disponibile al momento.</div>
        )}

        {!loading && !error && rooms.length > 0 && (
          <div className="rooms-grid">
            {rooms.map((room) => (
              <Link key={room.id} to={`/week/${room.id}`} className="room-card">
                <div className="room-card-icon">🖥️</div>
                <div className="room-card-name">{room.name}</div>
                <div className="room-card-cta">Visualizza calendario →</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
