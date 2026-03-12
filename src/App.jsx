import { createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Home from './pages/Home.jsx'
import WeekView from './pages/WeekView.jsx'
import BookingForm from './pages/BookingForm.jsx'
import RecurringForm from './pages/RecurringForm.jsx'
import AdminLogin from './pages/AdminLogin.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import AdminRooms from './pages/AdminRooms.jsx'
import AdminSlots from './pages/AdminSlots.jsx'
import AdminRecurring from './pages/AdminRecurring.jsx'
import AdminBookings from './pages/AdminBookings.jsx'
import AdminCalendar from './pages/AdminCalendar.jsx'
import AdminUsers from './pages/AdminUsers.jsx'
import AdminNotifications from './pages/AdminNotifications.jsx'

export const AdminContext = createContext({ is_superadmin: false })

export function useAdminContext() {
  return useContext(AdminContext)
}

function AdminGuard({ children }) {
  const auth = localStorage.getItem('admin_authenticated')
  const location = useLocation()
  if (auth !== 'true') {
    return <Navigate to="/admin" state={{ from: location }} replace />
  }
  const is_superadmin = localStorage.getItem('admin_is_superadmin') === 'true'
  return (
    <AdminContext.Provider value={{ is_superadmin }}>
      {children}
    </AdminContext.Provider>
  )
}

function SuperadminGuard({ children }) {
  const auth = localStorage.getItem('admin_authenticated')
  const is_superadmin = localStorage.getItem('admin_is_superadmin') === 'true'
  const location = useLocation()
  if (auth !== 'true') {
    return <Navigate to="/admin" state={{ from: location }} replace />
  }
  if (!is_superadmin) {
    return (
      <AdminContext.Provider value={{ is_superadmin: false }}>
        <div className="page">
          <div className="error-msg">⚠️ Non autorizzato. Accesso riservato al superamministratore.</div>
        </div>
      </AdminContext.Provider>
    )
  }
  return (
    <AdminContext.Provider value={{ is_superadmin: true }}>
      {children}
    </AdminContext.Provider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/week/:roomId" element={<WeekView />} />
        <Route path="/room/:roomId/book" element={<BookingForm />} />
        <Route path="/room/:roomId/recurring" element={<RecurringForm />} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
        <Route path="/admin/rooms" element={<AdminGuard><AdminRooms /></AdminGuard>} />
        <Route path="/admin/rooms/:id/slots" element={<AdminGuard><AdminSlots /></AdminGuard>} />
        <Route path="/admin/recurring" element={<AdminGuard><AdminRecurring /></AdminGuard>} />
        <Route path="/admin/bookings" element={<AdminGuard><AdminBookings /></AdminGuard>} />
        <Route path="/admin/calendar" element={<AdminGuard><AdminCalendar /></AdminGuard>} />
        <Route path="/admin/users" element={<SuperadminGuard><AdminUsers /></SuperadminGuard>} />
        <Route path="/admin/notifications" element={<SuperadminGuard><AdminNotifications /></SuperadminGuard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
