import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  adminGetRecurringRequests,
  adminApproveRecurring,
  adminDenyRecurring,
} from '../lib/api.js'
import { DAY_NAMES } from '../lib/dates.js'

function weekdayNames(days) {
  return days.map((d) => DAY_NAMES[d - 1]).join(', ')
}

function StatusBadge({ status }) {
  const map = { pending: 'badge-pending', approved: 'badge-approved', denied: 'badge-denied' }
  const labels = { pending: 'In attesa', approved: 'Approvata', denied: 'Negata' }
  return <span className={`badge ${map[status] || ''}`}>{labels[status] || status}</span>
}

function RequestCard({ req, onRefresh }) {
  const [denyNotes, setDenyNotes] = useState('')
  const [showDeny, setShowDeny] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [conflicts, setConflicts] = useState(null)

  const handleApprove = async () => {
    if (!confirm('Approvare questa richiesta? Verranno create tutte le prenotazioni nel periodo indicato.')) return
    setLoading(true)
    setError(null)
    try {
      const res = await adminApproveRecurring(req.id)
      if (res.overwritten && res.overwritten.length > 0) {
        setConflicts(res.overwritten)
      }
      onRefresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeny = async () => {
    setLoading(true)
    setError(null)
    try {
      await adminDenyRecurring(req.id, denyNotes)
      setShowDeny(false)
      onRefresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`request-card ${req.status}`}>
      <div className="request-card-header">
        <div>
          <strong>{req.teacher_name}</strong> · <span style={{ color: 'var(--gray-700)' }}>{req.class_name}</span>
        </div>
        <StatusBadge status={req.status} />
      </div>

      <div className="request-card-body">
        <span>🏫 {req.rooms?.name || req.room_id}</span>
        <span>⏰ {req.room_slots ? `${req.room_slots.start_time}–${req.room_slots.end_time}` : req.room_slot_id}</span>
        <span>📅 {req.start_date} → {req.end_date}</span>
        <span>📆 {weekdayNames(req.weekdays)}</span>
        <span style={{ color: 'var(--gray-500)', fontSize: '0.8rem' }}>
          Inviata: {new Date(req.created_at).toLocaleDateString('it-IT')}
        </span>
      </div>

      {req.admin_notes && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: 'var(--gray-700)', fontStyle: 'italic' }}>
          Note: {req.admin_notes}
        </div>
      )}

      {error && <div className="error-msg" style={{ marginTop: '0.5rem' }}>⚠️ {error}</div>}
      {conflicts && conflicts.length > 0 && (
        <div className="success-msg" style={{ marginTop: '0.5rem', fontSize: '0.82rem' }}>
          ✅ Approvata. Prenotazioni sovrascritte: {conflicts.join(', ')}
        </div>
      )}

      {req.status === 'pending' && (
        <div className="request-card-actions">
          <button className="btn btn-success btn-sm" onClick={handleApprove} disabled={loading}>
            ✅ Approva
          </button>
          {!showDeny ? (
            <button className="btn btn-danger btn-sm" onClick={() => setShowDeny(true)} disabled={loading}>
              ❌ Nega
            </button>
          ) : (
            <div className="deny-input">
              <input
                type="text"
                value={denyNotes}
                onChange={(e) => setDenyNotes(e.target.value)}
                placeholder="Note (opzionale)"
              />
              <button className="btn btn-danger btn-sm" onClick={handleDeny} disabled={loading}>
                Conferma
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowDeny(false)}>
                Annulla
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function AdminRecurring() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('pending')

  const load = () => {
    setLoading(true)
    adminGetRecurringRequests(filter || undefined)
      .then(setRequests)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filter])

  const pending = requests.filter((r) => r.status === 'pending')
  const decided = requests.filter((r) => r.status !== 'pending')

  return (
    <>
      <nav className="nav">
        <Link to="/admin/dashboard" className="nav-back">← Dashboard</Link>
        <span className="nav-title">Richieste Ricorrenti</span>
      </nav>

      <div className="page">
        {error && <div className="error-msg">⚠️ {error}</div>}

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {['', 'pending', 'approved', 'denied'].map((s) => (
            <button
              key={s}
              className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter(s)}
            >
              {s === '' ? 'Tutte' : s === 'pending' ? 'In attesa' : s === 'approved' ? 'Approvate' : 'Negate'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : requests.length === 0 ? (
          <div className="empty-state">Nessuna richiesta trovata.</div>
        ) : (
          <>
            {(filter === '' || filter === 'pending') && pending.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                {filter === '' && <h2 style={{ marginBottom: '0.75rem' }}>In attesa</h2>}
                {pending.map((req) => (
                  <RequestCard key={req.id} req={req} onRefresh={load} />
                ))}
              </div>
            )}

            {filter === '' && decided.length > 0 && (
              <div>
                <h2 style={{ marginBottom: '0.75rem' }}>Elaborate</h2>
                {decided.map((req) => (
                  <RequestCard key={req.id} req={req} onRefresh={load} />
                ))}
              </div>
            )}

            {filter !== '' && filter !== 'pending' && requests.map((req) => (
              <RequestCard key={req.id} req={req} onRefresh={load} />
            ))}
          </>
        )}
      </div>
    </>
  )
}
