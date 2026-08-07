import { useEffect, useRef, useState, useCallback } from 'react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'
const WS_BASE  = import.meta.env.VITE_WS_URL  || 'ws://127.0.0.1:8000'

// Refresh the access token using the refresh token
async function getFreshToken() {
  try {
    const refresh = localStorage.getItem('refresh')
    if (!refresh) return null
    const res = await axios.post(`${API_BASE}/auth/token/refresh/`, {
      refresh,
    })
    const newToken = res.data.access
    localStorage.setItem('access', newToken)
    // If backend rotates refresh tokens, save the new one too
    if (res.data.refresh) {
      localStorage.setItem('refresh', res.data.refresh)
    }
    return newToken
  } catch {
    return null
  }
}

export default function useRoomSocket(roomId) {
  const ws              = useRef(null)
  const reconnectTimer  = useRef(null)
  const typingTimer     = useRef(null)
  const refreshInterval = useRef(null)
  const intentionalClose = useRef(false)   // ← tracks deliberate disconnects

  const [comments, setComments]   = useState([])
  const [typing, setTyping]       = useState(null)
  const [connected, setConnected] = useState(false)

  const connect = useCallback(async () => {
    if (!roomId) return
    // Close existing connection if any
    if (ws.current && ws.current.readyState === WebSocket.OPEN) return

    // Always get a fresh token before connecting
    const token = await getFreshToken()
    if (!token) return

    intentionalClose.current = false

    ws.current = new WebSocket(
      `${WS_BASE}/ws/rooms/${roomId}/?token=${token}`
    )

    ws.current.onopen = () => {
      setConnected(true)
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current)
        reconnectTimer.current = null
      }

      // Refresh the token every 20 minutes to prevent expiry
      if (refreshInterval.current) clearInterval(refreshInterval.current)
      refreshInterval.current = setInterval(() => {
        getFreshToken()
      }, 20 * 60 * 1000)
    }

    ws.current.onmessage = (e) => {
      const data = JSON.parse(e.data)

      if (data.type === 'new_comment') {
        setComments(prev => [...prev, data])
      }

      if (data.type === 'user_typing') {
        setTyping(data.user)
        if (typingTimer.current) clearTimeout(typingTimer.current)
        typingTimer.current = setTimeout(() => setTyping(null), 2000)
      }
    }

    ws.current.onerror = () => {}

    ws.current.onclose = () => {
      setConnected(false)

      // Clear the token refresh interval
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current)
        refreshInterval.current = null
      }

      // Only reconnect if the close was NOT intentional (i.e. not from cleanup)
      if (!intentionalClose.current) {
        reconnectTimer.current = setTimeout(() => {
          connect()
        }, 3000)
      }
    }
  }, [roomId])

  useEffect(() => {
    connect()
    return () => {
      // Mark as intentional so onclose doesn't trigger reconnect
      intentionalClose.current = true
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      if (typingTimer.current) clearTimeout(typingTimer.current)
      if (refreshInterval.current) clearInterval(refreshInterval.current)
      ws.current?.close()
    }
  }, [connect])

  const sendComment = useCallback((snippetId, content, lineNumber = 0) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type:        'new_comment',
        snippet_id:  snippetId,
        content,
        line_number: lineNumber,
      }))
    }
  }, [])

  const sendTyping = useCallback((snippetId) => {
    try {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({
          type:       'user_typing',
          snippet_id: snippetId,
        }))
      }
    } catch {
      // ignore
    }
  }, [])

  return { comments, setComments, typing, connected, sendComment, sendTyping }
}