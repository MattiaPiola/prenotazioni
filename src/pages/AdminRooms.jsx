import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  adminGetRooms,
  adminCreateRoom,
  adminUpdateRoom,
  adminDeleteRoom,
} from '../lib/api.js'

export default function AdminRooms() {
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')

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
      await adminUpdateRoom(id, editName.trim())
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
                    <th>Nome Aula</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room) => (
                    <tr key={room.id}>
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
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <Link to={`/admin/rooms/${room.id}/slots`} className="btn btn-outline btn-sm">
                            ⏰ Orari
                          </Link>
                          {editId !== room.id && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => { setEditId(room.id); setEditName(room.name) }}
                            >
                              ✏️ Modifica
                            </button>
                          )}
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(room.id, room.name)}
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
