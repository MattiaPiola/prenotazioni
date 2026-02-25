import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  adminGetSlots,
  adminCreateSlot,
  adminUpdateSlot,
  adminDeleteSlot,
} from '../lib/api.js'

const emptyForm = { start_time: '', end_time: '', label: '', sort_order: 0 }

export default function AdminSlots() {
  const { id: roomId } = useParams()
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState(emptyForm)

  const load = () => {
    setLoading(true)
    adminGetSlots(roomId)
      .then(setSlots)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [roomId])

  const handleAdd = async (e) => {
    e.preventDefault()
    setAdding(true)
    try {
      await adminCreateSlot(roomId, {
        start_time: form.start_time,
        end_time: form.end_time,
        label: form.label || null,
        sort_order: parseInt(form.sort_order, 10) || 0,
      })
      setForm(emptyForm)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  const handleUpdate = async (slotId) => {
    try {
      await adminUpdateSlot(roomId, slotId, {
        start_time: editForm.start_time,
        end_time: editForm.end_time,
        label: editForm.label || null,
        sort_order: parseInt(editForm.sort_order, 10) || 0,
      })
      setEditId(null)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = async (slotId) => {
    if (!confirm('Eliminare questo orario? Verranno eliminate anche le prenotazioni associate.')) return
    try {
      await adminDeleteSlot(roomId, slotId)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <nav className="nav">
        <Link to="/admin/rooms" className="nav-back">← Aule</Link>
        <span className="nav-title">Orari Aula</span>
      </nav>

      <div className="page">
        {error && <div className="error-msg">⚠️ {error}</div>}

        {/* Add slot form */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>Aggiungi Orario</h2>
          <form onSubmit={handleAdd}>
            <div className="form-row">
              <div className="form-group">
                <label>Inizio *</label>
                <input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Fine *</label>
                <input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Etichetta (opzionale)</label>
                <input
                  type="text"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="Es. 1ª ora"
                />
              </div>
              <div className="form-group">
                <label>Ordine</label>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                  min="0"
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={adding}>
              {adding ? 'Aggiunta...' : '+ Aggiungi Orario'}
            </button>
          </form>
        </div>

        {/* Slots list */}
        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>Orari Configurati</h2>

          {loading ? (
            <div className="loading"><div className="spinner" /></div>
          ) : slots.length === 0 ? (
            <div className="empty-state">Nessun orario configurato per questa aula.</div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Inizio</th>
                    <th>Fine</th>
                    <th>Etichetta</th>
                    <th>Ordine</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {slots.map((slot) => (
                    <tr key={slot.id}>
                      {editId === slot.id ? (
                        <>
                          <td><input type="time" value={editForm.start_time} onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })} /></td>
                          <td><input type="time" value={editForm.end_time} onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value })} /></td>
                          <td><input type="text" value={editForm.label} onChange={(e) => setEditForm({ ...editForm, label: e.target.value })} placeholder="Etichetta" /></td>
                          <td><input type="number" value={editForm.sort_order} onChange={(e) => setEditForm({ ...editForm, sort_order: e.target.value })} style={{ width: '70px' }} /></td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              <button className="btn btn-success btn-sm" onClick={() => handleUpdate(slot.id)}>✓ Salva</button>
                              <button className="btn btn-secondary btn-sm" onClick={() => setEditId(null)}>Annulla</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{slot.start_time}</td>
                          <td>{slot.end_time}</td>
                          <td>{slot.label || <span style={{ color: 'var(--gray-500)' }}>—</span>}</td>
                          <td>{slot.sort_order}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => { setEditId(slot.id); setEditForm({ start_time: slot.start_time, end_time: slot.end_time, label: slot.label || '', sort_order: slot.sort_order }) }}
                              >
                                ✏️ Modifica
                              </button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(slot.id)}>
                                🗑️ Elimina
                              </button>
                            </div>
                          </td>
                        </>
                      )}
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
