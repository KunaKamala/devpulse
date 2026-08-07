import useAuthStore from '../store/authStore'
import { useNavigate } from 'react-router-dom'

export default function Dashboard() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.logo}>⚡ DevPulse</h1>
        <button onClick={handleLogout} style={styles.logoutBtn}>
          Logout
        </button>
      </div>
      <div style={styles.body}>
        <h2 style={styles.welcome}>Welcome, {user?.username} 👋</h2>
        <p style={styles.sub}>Your collaboration workspace is being built. Phase 2 coming next!</p>
        <div style={styles.card}>
          <p style={styles.cardText}>🚀 Phase 1 complete — Auth is working!</p>
        </div>
      </div>
    </div>
  )
}

const styles = {
  page:      { minHeight: '100vh', background: '#f9fafb' },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 2rem', background: '#fff', borderBottom: '1px solid #eee' },
  logo:      { fontSize: '20px', fontWeight: '700', color: '#6366f1' },
  logoutBtn: { padding: '8px 16px', borderRadius: '8px', border: '1px solid #6366f1', background: '#fff', color: '#6366f1', cursor: 'pointer', fontSize: '14px', fontWeight: '500' },
  body:      { padding: '2rem', maxWidth: '800px', margin: '0 auto' },
  welcome:   { fontSize: '24px', fontWeight: '600', marginBottom: '8px' },
  sub:       { color: '#666', marginBottom: '2rem' },
  card:      { background: '#fff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #eee' },
  cardText:  { color: '#6366f1', fontWeight: '500' },
}