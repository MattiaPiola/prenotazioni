import { useEffect, useState } from 'react'
import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import {
  adminGetRooms,
  adminCreateRoom,
  adminUpdateRoom,
  adminDeleteRoom,
  adminDuplicateRoom,
  adminReorderRooms,
} from '../lib/api.js'

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

export default function AdminRooms() {
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')
  const [settingsId, setSettingsId] = useState(null)
  const [settingsForm, setSettingsForm] = useState({})
  const [savingSettings, setSavingSettings] = useState(false)

  const load = () => {
    setLoading(true)
    adminGetRooms()
      .then(setRooms)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    try {
      await adminCreateRoom(newName.trim())
      setNewName('')
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  const handleUpdate = async (id) => {
    if (!editName.trim()) return
    try {
      await adminUpdateRoom(id, { name: editName.trim() })
      setEditId(null)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`Eliminare l'aula "${name}"? Verranno eliminate anche tutte le prenotazioni associate.`)) return
    try {
      await adminDeleteRoom(id)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDuplicate = async (id, name) => {
    if (!confirm(`Duplicare l'aula "${name}" con tutti i suoi orari?`)) return
    try {
      await adminDuplicateRoom(id)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleToggleActive = async (id, active) => {
    try {
      await adminUpdateRoom(id, { active: !active })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleMove = async (idx, direction) => {
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= rooms.length) return
    const updated = [...rooms]
    ;[updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]]
    setRooms(updated)
    try {
      await adminReorderRooms(updated.map((r, i) => ({ id: r.id, sort_order: i })))
    } catch (err) {
      setError(err.message)
      load()
    }
  }

  const openSettings = (room) => {
    setSettingsId(room.id)
    setSettingsForm({
      announcement: room.announcement || '',
      allow_user_edit: room.allow_user_edit || false,
      visible_weekdays: room.visible_weekdays || [0, 1, 2, 3, 4],
      emoji: room.emoji || '',
    })
  }

  const toggleWeekday = (day) => {
    const current = settingsForm.visible_weekdays || []
    const updated = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort((a, b) => a - b)
    setSettingsForm({ ...settingsForm, visible_weekdays: updated })
  }

  const handleSaveSettings = async (id) => {
    setSavingSettings(true)
    try {
      await adminUpdateRoom(id, {
        announcement: settingsForm.announcement || null,
        allow_user_edit: settingsForm.allow_user_edit,
        visible_weekdays: settingsForm.visible_weekdays,
        emoji: settingsForm.emoji || null,
      })
      setSettingsId(null)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingSettings(false)
    }
  }

  return (
    <>
      <nav className="nav">
        <Link to="/admin/dashboard" className="nav-back">← Dashboard</Link>
        <span className="nav-title">Gestione Aule</span>
      </nav>

      <div className="page">
        {error && <div className="error-msg">⚠️ {error}</div>}

        {/* Add room form */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>Aggiungi Aula</h2>
          <form onSubmit={handleAdd}>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nome aula (es. Aula 101)"
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={adding}>
                {adding ? 'Aggiunta...' : '+ Aggiungi'}
              </button>
            </div>
          </form>
        </div>

        {/* Rooms list */}
        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>Elenco Aule</h2>

          {loading ? (
            <div className="loading"><div className="spinner" /></div>
          ) : rooms.length === 0 ? (
            <div className="empty-state">Nessuna aula configurata.</div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '5rem' }}>Ordine</th>
                    <th>Nome Aula</th>
                    <th>Stato</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room, idx) => (
                    <Fragment key={room.id}>
                      <tr style={!room.active ? { opacity: 0.5 } : undefined}>
                        <td>
                          <div style={{ display: 'flex', gap: '0.2rem' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleMove(idx, -1)}
                              disabled={idx === 0}
                              title="Sposta su"
                            >↑</button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleMove(idx, 1)}
                              disabled={idx === rooms.length - 1}
                              title="Sposta giù"
                            >↓</button>
                          </div>
                        </td>
                        <td>
                          {editId === room.id ? (
                            <div className="inline-edit">
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleUpdate(room.id)
                                  if (e.key === 'Escape') setEditId(null)
                                }}
                                autoFocus
                              />
                              <button className="btn btn-success btn-sm" onClick={() => handleUpdate(room.id)}>
                                ✓ Salva
                              </button>
                              <button className="btn btn-secondary btn-sm" onClick={() => setEditId(null)}>
                                Annulla
                              </button>
                            </div>
                          ) : (
                            <strong>{room.name}</strong>
                          )}
                        </td>
                        <td>
                          <button
                            className={`btn btn-sm ${room.active ? 'btn-secondary' : 'btn-success'}`}
                            onClick={() => handleToggleActive(room.id, room.active)}
                            title={room.active ? "Disattiva l'aula" : "Attiva l'aula"}
                          >
                            {room.active ? '⏸ Disattiva' : '▶ Attiva'}
                          </button>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <Link to={`/admin/rooms/${room.id}/slots`} className="btn btn-outline btn-sm">
                              ⏰ Orari
                            </Link>
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => settingsId === room.id ? setSettingsId(null) : openSettings(room)}
                            >
                              ⚙️ Impostazioni
                            </button>
                            {editId !== room.id && (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => { setEditId(room.id); setEditName(room.name) }}
                              >
                                ✏️ Modifica
                              </button>
                            )}
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleDuplicate(room.id, room.name)}
                            >
                              📋 Duplica
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDelete(room.id, room.name)}
                            >
                              🗑️ Elimina
                            </button>
                          </div>
                        </td>
                      </tr>
                      {settingsId === room.id && (
                        <tr key={`settings-${room.id}`}>
                          <td colSpan={4} style={{ background: 'var(--gray-100)', padding: '1rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '600px' }}>
                              <div className="form-group">
                                <label>Emoji personalizzata (mostrata nella home)</label>
                                <input
                                  type="text"
                                  value={settingsForm.emoji}
                                  onChange={(e) => setSettingsForm({ ...settingsForm, emoji: e.target.value })}
                                  placeholder="Es. 🖥️ 📚 🔬"
                                  maxLength={20}
                                  style={{ width: '8rem' }}
                                />
                              </div>
                              <div className="form-group">
                                <label>Annuncio pubblico (mostrato nel calendario)</label>
                                <textarea
                                  rows={3}
                                  value={settingsForm.announcement}
                                  onChange={(e) => setSettingsForm({ ...settingsForm, announcement: e.target.value })}
                                  placeholder="Es. Aula disponibile solo al mattino"
                                  style={{ resize: 'vertical' }}
                                />
                              </div>
                              <div className="form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                  <input
                                    type="checkbox"
                                    checked={settingsForm.allow_user_edit}
                                    onChange={(e) => setSettingsForm({ ...settingsForm, allow_user_edit: e.target.checked })}
                                    style={{ width: 'auto' }}
                                  />
                                  Consenti agli utenti di cancellare le proprie prenotazioni
                                </label>
                              </div>
                              <div className="form-group">
                                <label>Giorni visibili nel calendario</label>
                                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                                  {DAY_LABELS.map((label, i) => (
                                    <label
                                      key={i}
                                      style={{
                                        display: 'flex', alignItems: 'center', gap: '0.3rem',
                                        padding: '0.3rem 0.6rem', border: '1px solid var(--gray-300)',
                                        borderRadius: '6px', cursor: 'pointer',
                                        background: (settingsForm.visible_weekdays || []).includes(i) ? 'var(--primary)' : 'white',
                                        color: (settingsForm.visible_weekdays || []).includes(i) ? 'white' : 'inherit',
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={(settingsForm.visible_weekdays || []).includes(i)}
                                        onChange={() => toggleWeekday(i)}
                                        style={{ display: 'none' }}
                                      />
                                      {label}
                                    </label>
                                  ))}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleSaveSettings(room.id)}
                                  disabled={savingSettings}
                                >
                                  {savingSettings ? 'Salvataggio...' : '✓ Salva impostazioni'}
                                </button>
                                <button className="btn btn-secondary btn-sm" onClick={() => setSettingsId(null)}>
                                  Annulla
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
