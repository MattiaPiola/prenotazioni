import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  adminGetBookings,
  adminCancelBooking,
  adminGetRooms,
  adminExportBookingsCSV,
} from '../lib/api.js'
import { formatDate, getWeekDates } from '../lib/dates.js'

export default function AdminBookings() {
  const weekDates = getWeekDates(0)
  const [rooms, setRooms] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({
    from: formatDate(weekDates[0]),
    to: formatDate(weekDates[6]),
    room_id: '',
  })

  useEffect(() => {
    adminGetRooms().then(setRooms).catch(() => {})
  }, [])

  const load = () => {
    setLoading(true)
    setError(null)
    adminGetBookings(filters)
      .then(setBookings)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleCancel = async (id) => {
    if (!confirm('Annullare questa prenotazione?')) return
    try {
      await adminCancelBooking(id)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleExport = async () => {
    try {
      const blob = await adminExportBookingsCSV(filters)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `prenotazioni_${filters.from}_${filters.to}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <nav className="nav">
        <Link to="/admin/dashboard" className="nav-back">← Dashboard</Link>
        <span className="nav-title">Prenotazioni</span>
      </nav>

      <div className="page-wide">
        {error && <div className="error-msg">⚠️ {error}</div>}

        {/* Filters */}
        <div className="filter-bar">
          <div className="form-group">
            <label>Da</label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>A</label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Aula</label>
            <select value={filters.room_id} onChange={(e) => setFilters({ ...filters, room_id: e.target.value })}>
              <option value="">Tutte</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignSelf: 'flex-end', paddingBottom: '1px' }}>
            <button className="btn btn-primary" onClick={load} disabled={loading}>
              🔍 Cerca
            </button>
            <button className="btn btn-secondary" onClick={handleExport}>
              ⬇️ CSV
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : bookings.length === 0 ? (
          <div className="empty-state">Nessuna prenotazione trovata per i filtri selezionati.</div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Aula</th>
                  <th>Orario</th>
                  <th>Docente</th>
                  <th>Classe</th>
                  <th>Tipo</th>
                  <th>Azione</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td>{b.date}</td>
                    <td>{b.rooms?.name || b.room_id}</td>
                    <td>
                      {b.room_slots
                        ? `${b.room_slots.start_time}–${b.room_slots.end_time}`
                        : b.room_slot_id}
                    </td>
                    <td>{b.teacher_name}</td>
                    <td>{b.class_name}</td>
                    <td>
                      <span className={`badge ${b.source === 'recurring' ? 'badge-recurring' : 'badge-single'}`}>
                        {b.source === 'recurring' ? '🔁 Ricorrente' : '📌 Singola'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleCancel(b.id)}
                      >
                        🗑️ Annulla
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && bookings.length > 0 && (
          <p style={{ marginTop: '0.75rem', fontSize: '0.82rem', color: 'var(--gray-700)' }}>
            {bookings.length} prenotazion{bookings.length === 1 ? 'e' : 'i'} trovat{bookings.length === 1 ? 'a' : 'e'}
          </p>
        )}
      </div>
    </>
  )
}
