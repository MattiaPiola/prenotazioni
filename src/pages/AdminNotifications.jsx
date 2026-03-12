import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  adminGetNotificationRules,
  adminCreateNotificationRule,
  adminUpdateNotificationRule,
  adminDeleteNotificationRule,
  adminGetRooms,
} from '../lib/api.js'

const EVENT_TYPE_LABELS = {
  booking_created: 'Prenotazione creata',
  recurring_request_created: 'Richiesta ricorrente creata',
  recurring_request_approved: 'Richiesta ricorrente approvata',
  recurring_request_denied: 'Richiesta ricorrente negata',
  booking_cancelled: 'Prenotazione cancellata',
}

const EMPTY_FORM = {
  enabled: true,
  event_type: 'booking_created',
  scope: 'all_rooms',
  room_ids: [],
  telegram_chat_id: '',
}

export default function AdminNotifications() {
  const [rules, setRules] = useState([])
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState(null)

  const load = () => {
    setLoading(true)
    Promise.all([adminGetNotificationRules(), adminGetRooms()])
      .then(([rulesData, roomsData]) => {
        setRules(rulesData || [])
        setRooms(roomsData || [])
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const openEdit = (rule) => {
    setEditId(rule.id)
    setForm({
      enabled: rule.enabled,
      event_type: rule.event_type,
      scope: rule.scope,
      room_ids: rule.room_ids || [],
      telegram_chat_id: rule.telegram_chat_id,
    })
    setShowForm(true)
  }

  const cancelForm = () => {
    setShowForm(false)
    setEditId(null)
    setForm(EMPTY_FORM)
  }

  const handleToggleRoom = (roomId) => {
    const current = form.room_ids || []
    const updated = current.includes(roomId)
      ? current.filter((id) => id !== roomId)
      : [...current, roomId]
    setForm({ ...form, room_ids: updated })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.telegram_chat_id.trim()) {
      setError('telegram_chat_id è obbligatorio')
      return
    }
    if (form.scope === 'specific_rooms' && form.room_ids.length === 0) {
      setError('Seleziona almeno un\'aula per il filtro per aula')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        enabled: form.enabled,
        event_type: form.event_type,
        scope: form.scope,
        room_ids: form.scope === 'specific_rooms' ? form.room_ids : null,
        telegram_chat_id: form.telegram_chat_id.trim(),
      }
      if (editId) {
        await adminUpdateNotificationRule(editId, payload)
      } else {
        await adminCreateNotificationRule(payload)
      }
      cancelForm()
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleEnabled = async (rule) => {
    try {
      await adminUpdateNotificationRule(rule.id, { enabled: !rule.enabled })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = async (rule) => {
    if (!confirm(`Eliminare questa regola di notifica?`)) return
    try {
      await adminDeleteNotificationRule(rule.id)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const getRoomNames = (roomIds) => {
    if (!roomIds || roomIds.length === 0) return '—'
    return roomIds
      .map((id) => rooms.find((r) => r.id === id)?.name || id)
      .join(', ')
  }

  return (
    <>
      <nav className="nav">
        <Link to="/admin/dashboard" className="nav-back">← Dashboard</Link>
        <span className="nav-title">Notifiche Telegram</span>
      </nav>

      <div className="page">
        {error && <div className="error-msg">⚠️ {error}</div>}

        {/* Add rule button */}
        {!showForm && (
          <div style={{ marginBottom: '1.25rem' }}>
            <button className="btn btn-primary" onClick={openCreate}>
              + Aggiungi regola
            </button>
          </div>
        )}

        {/* Create / Edit form */}
        {showForm && (
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ marginBottom: '1rem' }}>{editId ? 'Modifica regola' : 'Nuova regola'}</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '600px' }}>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.enabled}
                      onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                      style={{ width: 'auto' }}
                    />
                    Regola attiva
                  </label>
                </div>

                <div className="form-group">
                  <label htmlFor="event_type">Tipo di evento</label>
                  <select
                    id="event_type"
                    value={form.event_type}
                    onChange={(e) => setForm({ ...form, event_type: e.target.value })}
                  >
                    {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Filtro aule</label>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="scope"
                        value="all_rooms"
                        checked={form.scope === 'all_rooms'}
                        onChange={() => setForm({ ...form, scope: 'all_rooms', room_ids: [] })}
                        style={{ width: 'auto' }}
                      />
                      Tutte le aule
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="scope"
                        value="specific_rooms"
                        checked={form.scope === 'specific_rooms'}
                        onChange={() => setForm({ ...form, scope: 'specific_rooms' })}
                        style={{ width: 'auto' }}
                      />
                      Aule specifiche
                    </label>
                  </div>
                </div>

                {form.scope === 'specific_rooms' && (
                  <div className="form-group">
                    <label>Seleziona aule</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.25rem' }}>
                      {rooms.length === 0 && <span style={{ color: 'var(--gray-700)', fontSize: '0.875rem' }}>Nessuna aula disponibile</span>}
                      {rooms.map((room) => (
                        <label key={room.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={(form.room_ids || []).includes(room.id)}
                            onChange={() => handleToggleRoom(room.id)}
                            style={{ width: 'auto' }}
                          />
                          {room.emoji ? `${room.emoji} ` : ''}{room.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="telegram_chat_id">Telegram Chat ID</label>
                  <input
                    id="telegram_chat_id"
                    type="text"
                    value={form.telegram_chat_id}
                    onChange={(e) => setForm({ ...form, telegram_chat_id: e.target.value })}
                    placeholder="Es. -1001234567890 oppure 123456789"
                    required
                  />
                  <small style={{ color: 'var(--gray-700)', fontSize: '0.8rem' }}>
                    ID del gruppo o canale Telegram. Usa @userinfobot per trovarlo.
                  </small>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Salvataggio...' : editId ? '✓ Salva modifiche' : '+ Crea regola'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={cancelForm}>
                    Annulla
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Rules list */}
        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>Regole configurate</h2>

          {loading ? (
            <div className="loading"><div className="spinner" /></div>
          ) : rules.length === 0 ? (
            <div className="empty-state">Nessuna regola configurata.</div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Stato</th>
                    <th>Evento</th>
                    <th>Filtro aule</th>
                    <th>Chat ID</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.id}>
                      <td>
                        <button
                          className={`btn btn-sm ${rule.enabled ? 'btn-success' : 'btn-secondary'}`}
                          onClick={() => handleToggleEnabled(rule)}
                          title={rule.enabled ? 'Clicca per disattivare' : 'Clicca per attivare'}
                        >
                          {rule.enabled ? '✓ Attiva' : '○ Disattiva'}
                        </button>
                      </td>
                      <td>{EVENT_TYPE_LABELS[rule.event_type] || rule.event_type}</td>
                      <td>
                        {rule.scope === 'all_rooms'
                          ? 'Tutte le aule'
                          : `Specifiche: ${getRoomNames(rule.room_ids)}`}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                        {rule.telegram_chat_id}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => openEdit(rule)}
                          >
                            ✏️ Modifica
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(rule)}
                          >
                            🗑️ Elimina
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
