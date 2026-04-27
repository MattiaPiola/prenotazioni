import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { adminLogout, getSettings, adminUpdateSettings } from '../lib/api.js'
import { useAdminContext } from '../App.jsx'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { is_superadmin } = useAdminContext()
  const [maintenance, setMaintenance] = useState(false)
  const [maintenanceLoading, setMaintenanceLoading] = useState(false)

  useEffect(() => {
    if (!is_superadmin) return
    getSettings()
      .then((s) => setMaintenance(Boolean(s?.maintenance_mode)))
      .catch(() => {})
  }, [is_superadmin])

  const handleLogout = async () => {
    try {
      await adminLogout()
    } catch (_) {}
    localStorage.removeItem('admin_authenticated')
    localStorage.removeItem('admin_is_superadmin')
    navigate('/admin', { replace: true })
  }

  const handleToggleMaintenance = async () => {
    setMaintenanceLoading(true)
    try {
      await adminUpdateSettings({ maintenance_mode: !maintenance })
      setMaintenance((prev) => !prev)
    } catch (_) {}
    setMaintenanceLoading(false)
  }

  const sections = [
    { icon: '🏫', title: 'Gestione Laboratori', desc: 'Aggiungi, modifica, elimina laboratori', to: '/admin/rooms' },
    { icon: '📋', title: 'Richieste Ricorrenti', desc: 'Approva o nega richieste', to: '/admin/recurring' },
    { icon: '📅', title: 'Prenotazioni', desc: 'Visualizza e gestisci prenotazioni', to: '/admin/bookings' },
    { icon: '🗓️', title: 'Calendario', desc: 'Visualizza calendario, blocca slot', to: '/admin/calendar' },
  ]

  const superadminSections = [
    { icon: '👥', title: 'Amministratori', desc: 'Gestisci account admin dei laboratori', to: '/admin/users' },
    { icon: '🔔', title: 'Notifiche Telegram', desc: 'Configura notifiche per eventi', to: '/admin/notifications' },
  ]

  return (
    <>
      <nav className="nav">
        <span className="nav-brand">🔬 Admin</span>
        <div className="nav-actions">
          <button className="nav-back" onClick={handleLogout}>
            Esci
          </button>
        </div>
      </nav>

      <div className="page">
        <h1 style={{ marginBottom: '0.25rem' }}>Pannello di amministrazione</h1>
        <p style={{ color: 'var(--gray-700)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Gestisci laboratori, orari e prenotazioni del sistema.
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

        {is_superadmin && (
          <div style={{ marginTop: '1.5rem' }}>
            <h2 style={{ marginBottom: '0.75rem', fontSize: '1rem', color: 'var(--gray-700)' }}>
              Superamministratore
            </h2>
            <div className="admin-grid">
              {superadminSections.map((s) => (
                <Link key={s.to} to={s.to} className="admin-card">
                  <div className="admin-card-icon">{s.icon}</div>
                  <div className="admin-card-title">{s.title}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--gray-700)', marginTop: '0.25rem' }}>
                    {s.desc}
                  </div>
                </Link>
              ))}
            </div>

            <div className={`maintenance-toggle-bar${maintenance ? ' maintenance-toggle-bar--active' : ''}`}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                  🔧 Modalità manutenzione
                </div>
                <div style={{ fontSize: '0.8rem', color: maintenance ? 'var(--white)' : 'var(--gray-700)', marginTop: '0.15rem' }}>
                  {maintenance
                    ? 'Attiva — il sito pubblico mostra la schermata di manutenzione'
                    : 'Disattivata — il sito pubblico è accessibile normalmente'}
                </div>
              </div>
              <button
                className={`btn${maintenance ? ' btn-danger' : ' btn-primary'}`}
                onClick={handleToggleMaintenance}
                disabled={maintenanceLoading}
                style={{ whiteSpace: 'nowrap' }}
              >
                {maintenanceLoading ? '...' : maintenance ? 'Disattiva' : 'Attiva'}
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: '2rem' }}>
          <Link to="/" className="btn btn-outline">
            🔬 Visualizza sito pubblico
          </Link>
        </div>
      </div>
    </>
  )
}
