import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import { getRoom, getSnippets, createSnippet, deleteSnippet, requestAiReview, getAiReviews } from '../api/rooms'
import useRoomSocket from '../api/useRoomSocket'
import useAuthStore from '../store/authStore'
import api from '../api/axios'

const LANGUAGES = ['python', 'javascript', 'typescript', 'java', 'cpp', 'html', 'css', 'sql', 'other']

export default function RoomDetail() {
  const { roomId }                  = useParams()
  const navigate                    = useNavigate()
  const { user }                    = useAuthStore()

  const [room, setRoom]             = useState(null)
  const [snippets, setSnippets]     = useState([])
  const [activeSnippet, setActive]  = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newSnippet, setNewSnippet] = useState({ title: '', language: 'python', code: '# Write your code here\n' })
  const [commentText, setComment]   = useState('')
  const [lineNumber, setLineNumber] = useState(0)
  const [copied, setCopied]         = useState(false)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')

  // Right Panel Tab State: 'comments' | 'ai_review'
  const [activeTab, setActiveTab]   = useState('comments')
  const [aiReview, setAiReview]     = useState(null)
  const [aiLoading, setAiLoading]   = useState(false)
  const [aiError, setAiError]       = useState('')

  // Debounce ref for typing indicator — only send once per 1.5 seconds
  const typingDebounce = useRef(null)

  const { comments, setComments, typing, connected, sendComment, sendTyping } = useRoomSocket(roomId)

  useEffect(() => { fetchAll() }, [roomId])

  // Load existing comments & latest AI review when snippet changes
  useEffect(() => {
    if (!activeSnippet) return
    api.get(`/rooms/${roomId}/snippets/${activeSnippet.id}/comments/`)
      .then(res => setComments(res.data))
      .catch(() => {})

    // Load existing AI review if any
    getAiReviews(roomId, activeSnippet.id)
      .then(res => {
        if (res.data && res.data.length > 0) {
          setAiReview(res.data[0])
        } else {
          setAiReview(null)
        }
      })
      .catch(() => setAiReview(null))
  }, [activeSnippet, roomId])

  const fetchAll = async () => {
    try {
      const [roomRes, snippetRes] = await Promise.all([getRoom(roomId), getSnippets(roomId)])
      setRoom(roomRes.data)
      setSnippets(snippetRes.data)
      if (snippetRes.data.length > 0) setActive(snippetRes.data[0])
    } catch { setError('Failed to load room.') }
  }

  const handleCreateSnippet = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await createSnippet(roomId, newSnippet)
      setSnippets([res.data, ...snippets])
      setActive(res.data)
      setShowCreate(false)
      setNewSnippet({ title: '', language: 'python', code: '# Write your code here\n' })
    } catch { setError('Failed to create snippet.') }
    finally { setLoading(false) }
  }

  const handleDelete = async (snippetId) => {
    if (!window.confirm('Delete this snippet?')) return
    try {
      await deleteSnippet(roomId, snippetId)
      const updated = snippets.filter(s => s.id !== snippetId)
      setSnippets(updated)
      setActive(updated[0] || null)
    } catch { setError('Failed to delete.') }
  }

  const handleSendComment = (e) => {
    e.preventDefault()
    if (!commentText.trim() || !activeSnippet) return
    sendComment(activeSnippet.id, commentText, lineNumber)
    setComment('')
    setLineNumber(0)
  }

  const handleGetAiReview = async () => {
    if (!activeSnippet) return
    setActiveTab('ai_review')
    setAiLoading(true)
    setAiError('')
    try {
      const res = await requestAiReview(roomId, activeSnippet.id)
      setAiReview(res.data)
    } catch (err) {
      setAiError(err.response?.data?.error || 'Failed to generate AI Code Review.')
    } finally {
      setAiLoading(false)
    }
  }

  const copyInvite = () => {
    navigator.clipboard.writeText(room.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Debounced typing handler — sends at most once per 1.5s
  const handleTyping = (snippetId) => {
    if (typingDebounce.current) return
    sendTyping(snippetId)
    typingDebounce.current = setTimeout(() => {
      typingDebounce.current = null
    }, 1500)
  }

  // Only show comments for active snippet
  const activeComments = comments.filter(c => c.snippet_id === activeSnippet?.id || c.snippet === activeSnippet?.id)

  const getScoreColor = (score) => {
    if (score >= 80) return '#22c55e'
    if (score >= 50) return '#eab308'
    return '#ef4444'
  }

  if (error) return <div style={{ padding: '2rem', color: '#dc2626' }}>{error}</div>
  if (!room)  return <div style={{ padding: '2rem', color: '#888' }}>Loading...</div>

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <button onClick={() => navigate('/rooms')} style={s.backBtn}>← Rooms</button>
          <h1 style={s.roomName}>{room.name}</h1>
          <span style={connected ? s.connectedDot : s.disconnectedDot}>
            {connected ? '🟢 Live' : '🔴 Offline'}
          </span>
        </div>
        <div style={s.headerRight}>
          <button onClick={copyInvite} style={s.outlineBtn}>
            {copied ? '✅ Copied!' : '🔗 Copy Invite'}
          </button>
          <span style={s.memberCount}>{room.members.length} members</span>
        </div>
      </div>

      <div style={s.layout}>
        {/* Left Sidebar — snippets */}
        <div style={s.sidebar}>
          <button onClick={() => setShowCreate(true)} style={s.primaryBtn}>+ New Snippet</button>
          <div style={s.snippetList}>
            {snippets.length === 0 && <p style={s.emptyText}>No snippets yet.</p>}
            {snippets.map(sn => (
              <div key={sn.id}
                style={{ ...s.snippetItem, ...(activeSnippet?.id === sn.id ? s.snippetActive : {}) }}
                onClick={() => setActive(sn)}>
                <p style={s.snippetTitle}>{sn.title}</p>
                <div style={s.snippetMeta}>
                  <span style={s.langBadge}>{sn.language}</span>
                  <button onClick={e => { e.stopPropagation(); handleDelete(sn.id) }} style={s.deleteBtn}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center — Monaco editor */}
        <div style={s.main}>
          {activeSnippet ? (
            <>
              <div style={s.editorHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h2 style={s.editorTitle}>{activeSnippet.title}</h2>
                  <span style={s.authorTag}>by {activeSnippet.author.username}</span>
                </div>
                <button
                  onClick={handleGetAiReview}
                  disabled={aiLoading}
                  style={s.aiReviewBtn}
                >
                  {aiLoading ? '✨ Analyzing...' : '✨ Get AI Review'}
                </button>
              </div>
              <Editor
                height="calc(100vh - 130px)"
                language={activeSnippet.language}
                value={activeSnippet.code}
                theme="vs-dark"
                options={{
                  fontSize: 14,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  readOnly: activeSnippet.author.username !== user?.username
                }}
              />
            </>
          ) : (
            <div style={s.noSnippet}><p>Select a snippet or create a new one.</p></div>
          )}
        </div>

        {/* Right Panel — Comments & AI Review */}
        <div style={s.commentPanel}>
          {/* Tab Switcher */}
          <div style={s.tabHeader}>
            <button
              onClick={() => setActiveTab('comments')}
              style={{ ...s.tabBtn, ...(activeTab === 'comments' ? s.tabBtnActive : {}) }}
            >
              💬 Comments ({activeComments.length})
            </button>
            <button
              onClick={() => setActiveTab('ai_review')}
              style={{ ...s.tabBtn, ...(activeTab === 'ai_review' ? s.tabBtnActive : {}) }}
            >
              🤖 AI Review {aiReview && `(${aiReview.score}/100)`}
            </button>
          </div>

          {/* TAB 1: COMMENTS */}
          {activeTab === 'comments' && (
            <>
              {/* Typing indicator */}
              {typing && typing !== user?.username && (
                <p style={s.typingIndicator}>✍️ {typing} is typing...</p>
              )}

              {/* Comments list */}
              <div style={s.commentList}>
                {activeComments.length === 0 && (
                  <p style={s.emptyComments}>No comments yet. Be the first!</p>
                )}
                {activeComments.map((c, i) => (
                  <div key={c.id || i} style={s.commentCard}>
                    <div style={s.commentHeader}>
                      <span style={s.commentAuthor}>{c.author?.username || c.author}</span>
                      {c.line_number > 0 && (
                        <span style={s.lineBadge}>Line {c.line_number}</span>
                      )}
                    </div>
                    <p style={s.commentContent}>{c.content}</p>
                  </div>
                ))}
              </div>

              {/* Add comment form */}
              {activeSnippet && (
                <form onSubmit={handleSendComment} style={s.commentForm}>
                  <input
                    style={s.lineInput}
                    type="number"
                    min="0"
                    placeholder="Line #"
                    value={lineNumber}
                    onChange={e => setLineNumber(Number(e.target.value))}
                  />
                  <textarea
                    style={s.commentInput}
                    placeholder="Write a comment..."
                    value={commentText}
                    onChange={e => {
                      setComment(e.target.value)
                      handleTyping(activeSnippet?.id)
                    }}
                    rows={3}
                  />
                  <button type="submit" style={s.primaryBtn} disabled={!connected}>
                    {connected ? 'Send Comment' : 'Connecting...'}
                  </button>
                </form>
              )}
            </>
          )}

          {/* TAB 2: AI REVIEW */}
          {activeTab === 'ai_review' && (
            <div style={s.aiPanelContent}>
              {aiLoading && (
                <div style={s.aiLoadingBox}>
                  <div style={s.spinner}></div>
                  <p style={{ fontSize: '13px', color: '#a78bfa' }}>🤖 Gemini is analyzing code line by line...</p>
                </div>
              )}

              {aiError && (
                <div style={s.aiErrorBox}>
                  <p style={{ color: '#ef4444', fontSize: '13px' }}>{aiError}</p>
                </div>
              )}

              {!aiLoading && !aiReview && !aiError && (
                <div style={s.aiEmptyBox}>
                  <p style={{ fontSize: '14px', color: '#ccc', marginBottom: '10px' }}>No AI Review generated yet.</p>
                  <button onClick={handleGetAiReview} style={s.aiReviewBtn}>
                    ✨ Generate AI Review Now
                  </button>
                </div>
              )}

              {!aiLoading && aiReview && (
                <div style={s.aiResultsList}>
                  {/* Score & Summary Card */}
                  <div style={s.aiScoreCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>Code Score</span>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontWeight: '700',
                        fontSize: '13px',
                        color: '#fff',
                        backgroundColor: getScoreColor(aiReview.score)
                      }}>
                        {aiReview.score} / 100
                      </span>
                    </div>
                    <p style={{ fontSize: '13px', color: '#ccc', lineHeight: '1.4' }}>{aiReview.summary}</p>
                  </div>

                  {/* Bugs & Vulnerabilities */}
                  {aiReview.bugs && aiReview.bugs.length > 0 && (
                    <div style={s.aiSection}>
                      <h4 style={s.aiSectionTitle}>🐛 Bugs & Logic Flaws ({aiReview.bugs.length})</h4>
                      {aiReview.bugs.map((b, idx) => (
                        <div key={idx} style={s.bugItem}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                            {b.line > 0 && <span style={s.lineBadge}>Line {b.line}</span>}
                            <span style={{ fontSize: '12px', fontWeight: '600', color: '#f87171' }}>Issue</span>
                          </div>
                          <p style={{ fontSize: '12px', color: '#e5e7eb', marginBottom: '4px' }}>{b.issue}</p>
                          {b.fix && (
                            <div style={s.fixCodeBlock}>
                              <span style={{ fontSize: '10px', color: '#4ade80' }}>Suggested Fix:</span>
                              <pre style={{ margin: 0, fontSize: '11px', color: '#a7f3d0' }}>{b.fix}</pre>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Suggestions */}
                  {aiReview.suggestions && aiReview.suggestions.length > 0 && (
                    <div style={s.aiSection}>
                      <h4 style={s.aiSectionTitle}>💡 Refactoring Tips ({aiReview.suggestions.length})</h4>
                      {aiReview.suggestions.map((sug, idx) => (
                        <div key={idx} style={s.suggestionItem}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                            {sug.line > 0 && <span style={s.lineBadge}>Line {sug.line}</span>}
                            <span style={{ fontSize: '12px', fontWeight: '600', color: '#60a5fa' }}>{sug.title}</span>
                          </div>
                          <p style={{ fontSize: '12px', color: '#d1d5db' }}>{sug.details}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Improvements */}
                  {aiReview.improvements && aiReview.improvements.length > 0 && (
                    <div style={s.aiSection}>
                      <h4 style={s.aiSectionTitle}>🚀 Best Practices ({aiReview.improvements.length})</h4>
                      <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#9ca3af' }}>
                        {aiReview.improvements.map((imp, idx) => (
                          <li key={idx} style={{ marginBottom: '4px' }}>{imp}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <button onClick={handleGetAiReview} style={{ ...s.aiReviewBtn, width: '100%', marginTop: '10px' }}>
                    🔄 Re-analyze Snippet
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Snippet Modal */}
      {showCreate && (
        <div style={s.modal}>
          <div style={s.modalCard}>
            <h3 style={s.modalTitle}>New Snippet</h3>
            <form onSubmit={handleCreateSnippet} style={s.form}>
              <input style={s.input} placeholder="Snippet title"
                value={newSnippet.title}
                onChange={e => setNewSnippet({ ...newSnippet, title: e.target.value })} required />
              <select style={s.input} value={newSnippet.language}
                onChange={e => setNewSnippet({ ...newSnippet, language: e.target.value })}>
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <div style={{ border: '1px solid #444', borderRadius: '8px', overflow: 'hidden' }}>
                <Editor height="200px" language={newSnippet.language} value={newSnippet.code}
                  theme="vs-dark"
                  onChange={val => setNewSnippet({ ...newSnippet, code: val })}
                  options={{ fontSize: 13, minimap: { enabled: false } }} />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => setShowCreate(false)}
                  style={{ ...s.outlineBtn, flex: 1 }}>Cancel</button>
                <button type="submit" style={{ ...s.primaryBtn, flex: 1 }} disabled={loading}>
                  {loading ? 'Saving...' : 'Save Snippet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  page:             { height: '100vh', display: 'flex', flexDirection: 'column', background: '#1e1e1e' },
  header:           { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 1.5rem', background: '#252526', borderBottom: '1px solid #333' },
  headerLeft:       { display: 'flex', alignItems: 'center', gap: '14px' },
  headerRight:      { display: 'flex', alignItems: 'center', gap: '12px' },
  backBtn:          { padding: '6px 12px', borderRadius: '6px', border: '1px solid #555', background: 'transparent', color: '#ccc', cursor: 'pointer', fontSize: '13px' },
  roomName:         { fontSize: '18px', fontWeight: '600', color: '#fff' },
  connectedDot:     { fontSize: '12px', color: '#4ade80' },
  disconnectedDot:  { fontSize: '12px', color: '#f87171' },
  outlineBtn:       { padding: '6px 14px', borderRadius: '6px', border: '1px solid #6366f1', background: 'transparent', color: '#818cf8', cursor: 'pointer', fontSize: '13px' },
  memberCount:      { fontSize: '13px', color: '#888' },
  layout:           { display: 'flex', flex: 1, overflow: 'hidden' },
  sidebar:          { width: '220px', background: '#252526', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column', padding: '12px', gap: '12px', overflowY: 'auto' },
  primaryBtn:       { padding: '8px 14px', borderRadius: '8px', background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500', width: '100%' },
  snippetList:      { display: 'flex', flexDirection: 'column', gap: '6px' },
  snippetItem:      { padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', border: '1px solid transparent' },
  snippetActive:    { background: '#2d2d30', border: '1px solid #6366f1' },
  snippetTitle:     { fontSize: '13px', fontWeight: '500', color: '#ccc', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  snippetMeta:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  langBadge:        { fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: '#3c3c3c', color: '#888' },
  deleteBtn:        { background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '12px' },
  emptyText:        { fontSize: '12px', color: '#666', textAlign: 'center', marginTop: '1rem' },
  main:             { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  editorHeader:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: '#252526', borderBottom: '1px solid #333' },
  editorTitle:      { fontSize: '15px', fontWeight: '500', color: '#fff' },
  authorTag:        { fontSize: '12px', color: '#888' },
  aiReviewBtn:      { background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)' },
  noSnippet:        { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' },
  commentPanel:     { width: '320px', background: '#252526', borderLeft: '1px solid #333', display: 'flex', flexDirection: 'column', padding: '12px', gap: '10px', overflowY: 'auto' },
  tabHeader:        { display: 'flex', gap: '4px', borderBottom: '1px solid #383838', paddingBottom: '8px' },
  tabBtn:           { flex: 1, padding: '6px 8px', background: 'transparent', border: 'none', color: '#888', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
  tabBtnActive:     { background: '#333338', color: '#818cf8', fontWeight: '600' },
  typingIndicator:  { fontSize: '12px', color: '#818cf8', fontStyle: 'italic', padding: '6px 10px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '6px' },
  commentList:      { flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' },
  emptyComments:    { fontSize: '12px', color: '#555', textAlign: 'center', marginTop: '1rem' },
  commentCard:      { background: '#2d2d30', borderRadius: '8px', padding: '10px', border: '1px solid #333' },
  commentHeader:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' },
  commentAuthor:    { fontSize: '12px', fontWeight: '600', color: '#818cf8' },
  lineBadge:        { fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: '#3c3c3c', color: '#888' },
  commentContent:   { fontSize: '13px', color: '#ccc', lineHeight: 1.5 },
  commentForm:      { display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #333', paddingTop: '10px' },
  lineInput:        { padding: '6px 10px', borderRadius: '6px', border: '1px solid #444', background: '#1e1e1e', color: '#fff', fontSize: '12px', outline: 'none' },
  commentInput:     { padding: '8px 10px', borderRadius: '6px', border: '1px solid #444', background: '#1e1e1e', color: '#fff', fontSize: '13px', outline: 'none', resize: 'none', fontFamily: 'inherit' },
  aiPanelContent:   { flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' },
  aiLoadingBox:     { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem', gap: '12px', textAlign: 'center' },
  spinner:          { width: '24px', height: '24px', border: '3px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' },
  aiErrorBox:       { background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '8px', padding: '10px' },
  aiEmptyBox:       { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem', textAlign: 'center' },
  aiResultsList:    { display: 'flex', flexDirection: 'column', gap: '12px' },
  aiScoreCard:      { background: '#2d2d30', border: '1px solid #404040', borderRadius: '8px', padding: '12px' },
  aiSection:        { background: '#26262a', border: '1px solid #383838', borderRadius: '8px', padding: '10px' },
  aiSectionTitle:   { fontSize: '12px', fontWeight: '600', color: '#e5e7eb', marginBottom: '8px' },
  bugItem:          { background: '#1f1f23', borderLeft: '3px solid #ef4444', padding: '8px', borderRadius: '4px', marginBottom: '8px' },
  fixCodeBlock:     { background: '#111827', padding: '6px', borderRadius: '4px', marginTop: '4px', overflowX: 'auto' },
  suggestionItem:   { background: '#1f1f23', borderLeft: '3px solid #3b82f6', padding: '8px', borderRadius: '4px', marginBottom: '8px' },
  modal:            { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modalCard:        { background: '#1e1e1e', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '500px', border: '1px solid #333' },
  modalTitle:       { fontSize: '18px', fontWeight: '600', color: '#fff', marginBottom: '1.2rem' },
  form:             { display: 'flex', flexDirection: 'column', gap: '12px' },
  input:            { padding: '10px 14px', borderRadius: '8px', border: '1px solid #444', fontSize: '14px', outline: 'none', background: '#2d2d30', color: '#fff', fontFamily: 'inherit' },
}