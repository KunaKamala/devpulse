import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRooms, createRoom, joinRoom } from '../api/rooms'
import useAuthStore from '../store/authStore'

export default function Rooms() {
  const [rooms, setRooms]           = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin]     = useState(false)
  const [newRoom, setNewRoom]       = useState({ name: '', description: '' })
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)
  const { user, logout }            = useAuthStore()
  const navigate                    = useNavigate()

  useEffect(() => { fetchRooms() }, [])

  const fetchRooms = async () => {
    try {
      const res = await getRooms()
      setRooms(res.data)
    } catch {
      setError('Failed to load rooms.')
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await createRoom(newRoom)
      setRooms([...rooms, res.data])
      setShowCreate(false)
      setNewRoom({ name: '', description: '' })
    } catch {
      setError('Failed to create room.')
    } finally { setLoading(false) }
  }

  const handleJoin = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await joinRoom(inviteCode)
      setRooms([...rooms, res.data])
      setShowJoin(false)
      setInviteCode('')
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid invite code.')
    } finally { setLoading(false) }
  }

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <h1 style={s.logo}>⚡ DevPulse</h1>
        <div style={s.headerRight}>
          <span style={s.username}>{user?.username}</span>
          <button onClick={handleLogout} style={s.outlineBtn}>Logout</button>
        </div>
      </div>

      {/* Body */}
      <div style={s.body}>
        <div style={s.topBar}>
          <h2 style={s.pageTitle}>Your Rooms</h2>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setShowJoin(true)}  style={s.outlineBtn}>Join Room</button>
            <button onClick={() => setShowCreate(true)} style={s.primaryBtn}>+ Create Room</button>
          </div>
        </div>

        {error && <p style={s.error}>{error}</p>}

        {/* Create Room Modal */}
        {showCreate && (
          <div style={s.modal}>
            <div style={s.modalCard}>
              <h3 style={s.modalTitle}>Create a new room</h3>
              <form onSubmit={handleCreate} style={s.form}>
                <input style={s.input} placeholder="Room name" value={newRoom.name}
                  onChange={e => setNewRoom({ ...newRoom, name: e.target.value })} required />
                <textarea style={{ ...s.input, height: '80px', resize: 'none' }}
                  placeholder="Description (optional)" value={newRoom.description}
                  onChange={e => setNewRoom({ ...newRoom, description: e.target.value })} />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" onClick={() => setShowCreate(false)} style={{ ...s.outlineBtn, flex: 1 }}>Cancel</button>
                  <button type="submit" style={{ ...s.primaryBtn, flex: 1 }} disabled={loading}>
                    {loading ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Join Room Modal */}
        {showJoin && (
          <div style={s.modal}>
            <div style={s.modalCard}>
              <h3 style={s.modalTitle}>Join a room</h3>
              <form onSubmit={handleJoin} style={s.form}>
                <input style={s.input} placeholder="Paste invite code here"
                  value={inviteCode} onChange={e => setInviteCode(e.target.value)} required />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" onClick={() => setShowJoin(false)} style={{ ...s.outlineBtn, flex: 1 }}>Cancel</button>
                  <button type="submit" style={{ ...s.primaryBtn, flex: 1 }} disabled={loading}>
                    {loading ? 'Joining...' : 'Join'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Rooms Grid */}
        {rooms.length === 0 ? (
          <div style={s.empty}>
            <p style={s.emptyText}>No rooms yet.</p>
            <p style={s.emptySubText}>Create a room or join one with an invite code.</p>
          </div>
        ) : (
          <div style={s.grid}>
            {rooms.map(room => (
              <div key={room.id} style={s.card} onClick={() => navigate(`/rooms/${room.id}`)}>
                <h3 style={s.cardTitle}>{room.name}</h3>
                <p style={s.cardDesc}>{room.description || 'No description'}</p>
                <div style={s.cardFooter}>
                  <span style={s.badge}>{room.snippet_count} snippets</span>
                  <span style={s.badge}>{room.members.length} members</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  page:        { minHeight: '100vh', background: '#f9fafb' },
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 2rem', background: '#fff', borderBottom: '1px solid #eee' },
  logo:        { fontSize: '20px', fontWeight: '700', color: '#6366f1' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '12px' },
  username:    { fontSize: '14px', color: '#666' },
  body:        { padding: '2rem', maxWidth: '1000px', margin: '0 auto' },
  topBar:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
  pageTitle:   { fontSize: '22px', fontWeight: '600' },
  primaryBtn:  { padding: '8px 18px', borderRadius: '8px', background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '500' },
  outlineBtn:  { padding: '8px 18px', borderRadius: '8px', background: '#fff', color: '#6366f1', border: '1px solid #6366f1', cursor: 'pointer', fontSize: '14px' },
  error:       { background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: '8px', marginBottom: '1rem', fontSize: '13px' },
  modal:       { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modalCard:   { background: '#fff', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '420px' },
  modalTitle:  { fontSize: '18px', fontWeight: '600', marginBottom: '1.2rem' },
  form:        { display: 'flex', flexDirection: 'column', gap: '12px' },
  input:       { padding: '10px 14px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', outline: 'none', fontFamily: 'inherit' },
  grid:        { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' },
  card:        { background: '#fff', padding: '1.4rem', borderRadius: '12px', border: '1px solid #eee', cursor: 'pointer', transition: 'box-shadow 0.2s' },
  cardTitle:   { fontSize: '16px', fontWeight: '600', marginBottom: '6px' },
  cardDesc:    { fontSize: '13px', color: '#888', marginBottom: '1rem' },
  cardFooter:  { display: 'flex', gap: '8px' },
  badge:       { fontSize: '12px', padding: '3px 10px', borderRadius: '20px', background: '#eef2ff', color: '#6366f1' },
  empty:       { textAlign: 'center', padding: '4rem 0' },
  emptyText:   { fontSize: '18px', fontWeight: '500', color: '#444' },
  emptySubText:{ fontSize: '14px', color: '#888', marginTop: '8px' },
}