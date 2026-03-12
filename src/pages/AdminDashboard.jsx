import { useNavigate, Link } from 'react-router-dom'
import { adminLogout } from '../lib/api.js'
import { useAdminContext } from '../App.jsx'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { is_superadmin } = useAdminContext()

  const handleLogout = async () => {
    try {
      await adminLogout()
    } catch (_) {}
    localStorage.removeItem('admin_authenticated')
    localStorage.removeItem('admin_is_superadmin')
    navigate('/admin', { replace: true })
  }

  const sections = [
    { icon: '🏫', title: 'Gestione Aule', desc: 'Aggiungi, modifica, elimina aule', to: '/admin/rooms' },
    { icon: '📋', title: 'Richieste Ricorrenti', desc: 'Approva o nega richieste', to: '/admin/recurring' },
    { icon: '📅', title: 'Prenotazioni', desc: 'Visualizza e gestisci prenotazioni', to: '/admin/bookings' },
    { icon: '🗓️', title: 'Calendario', desc: 'Visualizza calendario, blocca slot', to: '/admin/calendar' },
  ]

  if (is_superadmin) {
    sections.push({ icon: '👥', title: 'Amministratori', desc: 'Gestisci account admin delle aule', to: '/admin/users' })
  }

  return (
    <>
      <nav className="nav">
        <span className="nav-brand">🖥️ Admin</span>
        <div className="nav-actions">
          <button className="nav-back" onClick={handleLogout}>
            Esci
          </button>
        </div>
      </nav>

      <div className="page">
        <h1 style={{ marginBottom: '0.25rem' }}>Pannello di amministrazione</h1>
        <p style={{ color: 'var(--gray-700)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Gestisci aule, orari e prenotazioni del sistema.
        </p>

        <div className="admin-grid">
          {sections.map((s) => (
            <Link key={s.to} to={s.to} className="admin-card">
              <div className="admin-card-icon">{s.icon}</div>
              <div className="admin-card-title">{s.title}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--gray-700)', marginTop: '0.25rem' }}>
                {s.desc}
              </div>
            </Link>
          ))}
        </div>

        <div style={{ marginTop: '2rem' }}>
          <Link to="/" className="btn btn-outline">
            🖥️ Visualizza sito pubblico
          </Link>
        </div>
      </div>
    </>
  )
}
