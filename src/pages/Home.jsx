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
        <span className="nav-brand">🔬 Prenotazione laboratori</span>
        <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)' }}>
          {weekLabel}
        </span>
        <Link
          to="/admin"
          className="nav-back"
          style={{ marginLeft: 'auto', opacity: 0.7, fontSize: '0.85rem' }}
          title="Pannello amministratore"
          aria-label="Pannello amministratore"
        >
          ⚙️
        </Link>
      </nav>

      <div className="page">
        <h1 style={{ marginBottom: '0.25rem' }}>Laboratori</h1>
        <p style={{ color: 'var(--gray-700)', marginBottom: '0.25rem', fontSize: '0.95rem' }}>
          Seleziona un laboratorio per visualizzare e gestire le prenotazioni.
        </p>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.82rem', marginBottom: '1.5rem' }}>
          Settimana corrente: {weekLabel}
        </p>

        {loading && (
          <div className="loading">
            <div className="spinner" />
            <span>Caricamento laboratori...</span>
          </div>
        )}

        {error && <div className="error-msg">⚠️ {error}</div>}

        {!loading && !error && rooms.length === 0 && (
          <div className="empty-state">Nessun laboratorio disponibile al momento.</div>
        )}

        {!loading && !error && rooms.length > 0 && (
          <div className="rooms-grid">
            {rooms.map((room) => (
              <Link key={room.id} to={`/week/${room.id}`} className="room-card">
                <div className="room-card-icon">{room.emoji || '🔬'}</div>
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
