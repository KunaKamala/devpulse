import { create } from 'zustand'
import api from '../api/axios'

const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,   // ← starts true so ProtectedRoute waits

  // Call this on app load to restore session
  loadUser: async () => {
    const token = localStorage.getItem('access')
    if (!token) {
      set({ user: null, isAuthenticated: false, isLoading: false })
      return
    }
    try {
      const res = await api.get('/auth/me/')
      set({ user: res.data, isAuthenticated: true, isLoading: false })
    } catch {
      localStorage.clear()
      set({ user: null, isAuthenticated: false, isLoading: false })
    }
  },

  login: async (username, password) => {
    const res = await api.post('/auth/login/', { username, password })
    localStorage.setItem('access', res.data.access)
    localStorage.setItem('refresh', res.data.refresh)
    set({ user: res.data.user, isAuthenticated: true, isLoading: false })
  },

  register: async (username, email, password) => {
    const res = await api.post('/auth/register/', { username, email, password })
    localStorage.setItem('access', res.data.access)
    localStorage.setItem('refresh', res.data.refresh)
    set({ user: res.data.user, isAuthenticated: true, isLoading: false })
  },

  logout: () => {
    localStorage.clear()
    set({ user: null, isAuthenticated: false, isLoading: false })
  },
}))

export default useAuthStore