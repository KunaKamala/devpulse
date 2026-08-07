import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import useAuthStore from '../store/authStore'

export default function Login() {
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.username, form.password)
      navigate('/rooms')
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={styles.title}>Welcome back</h2>
        <p style={styles.sub}>Sign in to DevPulse</p>

        {error && <p style={styles.error}>{error}</p>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            style={styles.input}
            name="username"
            placeholder="Username"
            value={form.username}
            onChange={handleChange}
            required
          />
          <input
            style={styles.input}
            name="password"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            required
          />
          <button style={styles.btn} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p style={styles.link}>
          No account?{' '}
          <Link to="/register" style={{ color: '#6366f1' }}>
            Register here
          </Link>
        </p>
      </div>
    </div>
  )
}

const styles = {
  page:  { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' },
  card:  { background: '#fff', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' },
  title: { fontSize: '22px', fontWeight: '600', marginBottom: '4px' },
  sub:   { color: '#888', fontSize: '14px', marginBottom: '1.5rem' },
  form:  { display: 'flex', flexDirection: 'column', gap: '12px' },
  input: { padding: '10px 14px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', outline: 'none' },
  btn:   { padding: '10px', borderRadius: '8px', background: '#6366f1', color: '#fff', border: 'none', fontWeight: '500', cursor: 'pointer', fontSize: '15px' },
  error: { background: '#fef2f2', color: '#dc2626', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', marginBottom: '8px' },
  link:  { textAlign: 'center', marginTop: '1rem', fontSize: '14px', color: '#666' },
}