import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'

const api = axios.create({
  baseURL: API_BASE,
})

// Attach access token to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// If token expired (401), try refreshing automatically
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refresh = localStorage.getItem('refresh')
        const res = await axios.post(`${API_BASE}/auth/token/refresh/`, {
          refresh,
        })
        localStorage.setItem('access', res.data.access)
        // Backend rotates refresh tokens — save the new one
        if (res.data.refresh) {
          localStorage.setItem('refresh', res.data.refresh)
        }
        original.headers.Authorization = `Bearer ${res.data.access}`
        return api(original)
      } catch {
        localStorage.clear()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api