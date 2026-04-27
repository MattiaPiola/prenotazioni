export default function MaintenanceScreen() {
  return (
    <div className="maintenance-overlay">
      <div className="maintenance-box">
        <div className="maintenance-icon">🔧</div>
        <h1 className="maintenance-title">Manutenzione in corso</h1>
        <p className="maintenance-desc">
          Il sistema è temporaneamente in manutenzione.<br />
          Riprova tra qualche minuto.
        </p>
      </div>
    </div>
  )
}
