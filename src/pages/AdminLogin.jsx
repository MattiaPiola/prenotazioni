import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminLogin } from '../lib/api.js'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { role } = await adminLogin(code)
      localStorage.setItem('admin_authenticated', 'true')
      localStorage.setItem('admin_role', role || 'admin')
      navigate('/admin/dashboard', { replace: true })
    } catch (err) {
      if (err.status === 401) {
        setError('Codice di accesso non valido.')
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <nav className="nav">
        <span className="nav-brand">🖥️ Prenotazioni Aule</span>
      </nav>

      <div className="page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '3rem' }}>
        <div style={{ width: '100%', maxWidth: '380px' }}>
          <div className="card">
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔐</div>
              <h2>Accesso Amministratore</h2>
              <p style={{ color: 'var(--gray-700)', fontSize: '0.875rem', marginTop: '0.35rem' }}>
                Inserisci il codice di accesso
              </p>
            </div>

            {error && <div className="error-msg">⚠️ {error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="code">Codice di accesso</label>
                <input
                  id="code"
                  type="password"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="••••••••"
                  autoFocus
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-block btn-lg"
                disabled={loading}
                style={{ marginTop: '0.5rem' }}
              >
                {loading ? 'Verifica...' : 'Accedi'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
