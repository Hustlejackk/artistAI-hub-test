import { useState } from 'react'
import { api } from '../../api'

export default function NotesTab({ artist, onRefresh }) {
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!content.trim()) return
    setSaving(true)
    setError(null)
    try {
      await api.addNote(artist.id, { content: content.trim() })
      setContent('')
      await onRefresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (nid) => {
    if (!window.confirm('Delete this note?')) return
    try {
      await api.deleteNote(artist.id, nid)
      await onRefresh()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white font-semibold mb-1">Notes & Observations</h2>
        <p className="text-gray-500 text-sm">Timestamped internal notes visible to the AI during analysis generation.</p>
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700/50 rounded-lg px-4 py-3 text-red-300 text-sm">{error}</div>
      )}

      {/* Add note form */}
      <form onSubmit={handleSubmit} className="card">
        <label className="label">New Note</label>
        <textarea
          className="input-field resize-none mb-3"
          rows={3}
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Observations, context, strategy thoughts, meeting notes, ideas…"
        />
        <button type="submit" className="btn-primary text-sm" disabled={saving || !content.trim()}>
          {saving ? 'Saving…' : 'Add Note'}
        </button>
      </form>

      {/* Notes list */}
      {artist.notes?.length > 0 ? (
        <div className="space-y-3">
          {artist.notes.map(note => (
            <div key={note.id} className="card group">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{note.content}</p>
                  <p className="text-gray-600 text-xs mt-2">{fmtDate(note.created_at)}</p>
                </div>
                <button
                  onClick={() => handleDelete(note.id)}
                  className="btn-danger opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-600 text-sm">No notes yet. Add observations, meeting notes, or any context that will help the AI produce better analysis.</p>
      )}
    </div>
  )
}

function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}
