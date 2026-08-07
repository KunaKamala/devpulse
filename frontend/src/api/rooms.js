import api from './axios'

// ── Rooms ──────────────────────────────────────────
export const getRooms        = ()           => api.get('/rooms/')
export const createRoom      = (data)       => api.post('/rooms/', data)
export const getRoom         = (roomId)     => api.get(`/rooms/${roomId}/`)
export const deleteRoom      = (roomId)     => api.delete(`/rooms/${roomId}/`)
export const joinRoom        = (inviteCode) => api.post('/rooms/join/', { invite_code: inviteCode })

// ── Snippets ───────────────────────────────────────
export const getSnippets     = (roomId)             => api.get(`/rooms/${roomId}/snippets/`)
export const createSnippet   = (roomId, data)       => api.post(`/rooms/${roomId}/snippets/`, data)
export const updateSnippet   = (roomId, snippetId, data) => api.put(`/rooms/${roomId}/snippets/${snippetId}/`, data)
export const deleteSnippet   = (roomId, snippetId)  => api.delete(`/rooms/${roomId}/snippets/${snippetId}/`)

// ── AI Code Review ─────────────────────────────────
export const requestAiReview = (roomId, snippetId)  => api.post(`/rooms/${roomId}/snippets/${snippetId}/ai-review/`)
export const getAiReviews    = (roomId, snippetId)  => api.get(`/rooms/${roomId}/snippets/${snippetId}/ai-review/`)