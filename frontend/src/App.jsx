
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/authStore'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Rooms from './pages/Rooms'
import RoomDetail from './pages/RoomDetail'

export default function App() {
  const loadUser = useAuthStore((s) => s.loadUser)

  useEffect(() => { loadUser() }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"          element={<Navigate to="/rooms" replace />} />
        <Route path="/login"     element={<Login />} />
        <Route path="/register"  element={<Register />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/rooms"     element={<ProtectedRoute><Rooms /></ProtectedRoute>} />
        <Route path="/rooms/:roomId" element={<ProtectedRoute><RoomDetail /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  )
}