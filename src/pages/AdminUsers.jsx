import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  adminGetAdminUsers,
  adminCreateAdminUser,
  adminUpdateAdminUser,
  adminDeleteAdminUser,
  adminSetAdminUserRooms,
  adminGetRooms,
} from '../lib/api.js'

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // New user form state
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState({ name: '', code: '', room_ids: [] })
  const [creating, setCreating] = useState(false)

  // Edit user state
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', code: '', active: true, room_ids: [] })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [usersData, roomsData] = await Promise.all([adminGetAdminUsers(), adminGetRooms()])
      setUsers(usersData)
      setRooms(roomsData)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newForm.name.trim() || !newForm.code.trim()) return
    setCreating(true)
    try {
      await adminCreateAdminUser({
        name: newForm.name.trim(),
        code: newForm.code,
        room_ids: newForm.room_ids,
      })
      setNewForm({ name: '', code: '', room_ids: [] })
      setShowNew(false)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const openEdit = (user) => {
    const assignedRoomIds = (user.admin_room_permissions || []).map((p) => p.room_id)
    setEditId(user.id)
    setEditForm({ name: user.name, code: '', active: user.active, room_ids: assignedRoomIds })
  }

  const handleSave = async (id) => {
    setSaving(true)
    try {
      const updates = { name: editForm.name.trim(), active: editForm.active }
      if (editForm.code.trim()) updates.code = editForm.code
      await adminUpdateAdminUser(id, updates)
      await adminSetAdminUserRooms(id, editForm.room_ids)
      setEditId(null)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`Eliminare l'amministratore "${name}"?`)) return
    try {
      await adminDeleteAdminUser(id)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const toggleRoom = (form, setForm, roomId) => {
    const ids = form.room_ids
    const updated = ids.includes(roomId) ? ids.filter((id) => id !== roomId) : [...ids, roomId]
    setForm({ ...form, room_ids: updated })
  }

  return (
    <>
      <nav className="nav">
        <Link to="/admin/dashboard" className="nav-back">← Dashboard</Link>
        <span className="nav-title">Gestione Amministratori</span>
      </nav>

      <div className="page">
        {error && <div className="error-msg" style={{ marginBottom: '1rem' }}>⚠️ {error}</div>}

        {/* Add new admin-user */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showNew ? '1rem' : 0 }}>
            <h2>Nuovo amministratore aula</h2>
            <button className="btn btn-primary btn-sm" onClick={() => setShowNew(!showNew)}>
              {showNew ? 'Annulla' : '+ Aggiungi'}
            </button>
          </div>

          {showNew && (
            <form onSubmit={handleCreate}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '500px' }}>
                <div className="form-group">
                  <label>Nome</label>
                  <input
                    type="text"
                    value={newForm.name}
                    onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                    placeholder="Es. Mario Rossi"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Codice di accesso</label>
                  <input
                    type="password"
                    value={newForm.code}
                    onChange={(e) => setNewForm({ ...newForm, code: e.target.value })}
                    placeholder="Inserisci il codice"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Aule assegnate</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.25rem' }}>
                    {rooms.map((room) => {
                      const selected = newForm.room_ids.includes(room.id)
                      return (
                        <label
                          key={room.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.3rem',
                            padding: '0.3rem 0.6rem', border: '1px solid var(--gray-300)',
                            borderRadius: '6px', cursor: 'pointer',
                            background: selected ? 'var(--primary)' : 'white',
                            color: selected ? 'white' : 'inherit',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleRoom(newForm, setNewForm, room.id)}
                            style={{ display: 'none' }}
                          />
                          {room.emoji ? `${room.emoji} ` : ''}{room.name}
                        </label>
                      )
                    })}
                    {rooms.length === 0 && <span style={{ color: 'var(--gray-700)', fontSize: '0.875rem' }}>Nessuna aula disponibile</span>}
                  </div>
                </div>
                <div>
                  <button type="submit" className="btn btn-primary" disabled={creating}>
                    {creating ? 'Creazione...' : 'Crea amministratore'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Admin users list */}
        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>Amministratori aule</h2>

          {loading ? (
            <div className="loading"><div className="spinner" /></div>
          ) : users.length === 0 ? (
            <div className="empty-state">Nessun amministratore creato.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {users.map((user) => (
                <div key={user.id} style={{ border: '1px solid var(--gray-300)', borderRadius: 'var(--radius)', padding: '1rem' }}>
                  {editId === user.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '500px' }}>
                      <div className="form-group">
                        <label>Nome</label>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Nuovo codice di accesso (lascia vuoto per non cambiare)</label>
                        <input
                          type="password"
                          value={editForm.code}
                          onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                          placeholder="Nuovo codice..."
                        />
                      </div>
                      <div className="form-group">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={editForm.active}
                            onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
                            style={{ width: 'auto' }}
                          />
                          Account attivo
                        </label>
                      </div>
                      <div className="form-group">
                        <label>Aule assegnate</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.25rem' }}>
                          {rooms.map((room) => {
                            const selected = editForm.room_ids.includes(room.id)
                            return (
                              <label
                                key={room.id}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '0.3rem',
                                  padding: '0.3rem 0.6rem', border: '1px solid var(--gray-300)',
                                  borderRadius: '6px', cursor: 'pointer',
                                  background: selected ? 'var(--primary)' : 'white',
                                  color: selected ? 'white' : 'inherit',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => toggleRoom(editForm, setEditForm, room.id)}
                                  style={{ display: 'none' }}
                                />
                                {room.emoji ? `${room.emoji} ` : ''}{room.name}
                              </label>
                            )
                          })}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleSave(user.id)}
                          disabled={saving}
                        >
                          {saving ? 'Salvataggio...' : '✓ Salva'}
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditId(null)}>
                          Annulla
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          {user.name}
                          {!user.active && (
                            <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', background: 'var(--gray-300)', padding: '0.1rem 0.4rem', borderRadius: '4px', color: 'var(--gray-700)' }}>
                              Inattivo
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--gray-700)', marginTop: '0.25rem' }}>
                          Aule:{' '}
                          {(user.admin_room_permissions || []).length === 0
                            ? 'Nessuna'
                            : (user.admin_room_permissions || []).map((p) => p.rooms?.name || p.room_id).join(', ')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(user)}>
                          ✏️ Modifica
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(user.id, user.name)}>
                          🗑️ Elimina
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
