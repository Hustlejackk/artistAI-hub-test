import { useState } from 'react'
import { api } from '../../api'

const RELEASE_INIT = { title: '', type: '', release_date: '', performance_notes: '', promotional_context: '' }
const TYPE_OPTS = ['', 'single', 'EP', 'album', 'mixtape', 'other']

const TYPE_COLORS = {
  single: 'bg-blue-900/40 text-blue-300 border-blue-700/40',
  EP: 'bg-violet-900/40 text-violet-300 border-violet-700/40',
  album: 'bg-amber-900/40 text-amber-300 border-amber-700/40',
  mixtape: 'bg-pink-900/40 text-pink-300 border-pink-700/40',
  other: 'bg-gray-800 text-gray-400 border-gray-700',
}

export default function ReleasesTab({ artist, onRefresh }) {
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(RELEASE_INIT)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const openAdd = () => {
    setForm(RELEASE_INIT)
    setEditingId(null)
    setFormOpen(true)
  }

  const openEdit = (release) => {
    setForm({
      title: release.title || '',
      type: release.type || '',
      release_date: release.release_date || '',
      performance_notes: release.performance_notes || '',
      promotional_context: release.promotional_context || ''
    })
    setEditingId(release.id)
    setFormOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) { setError('Title is required'); return }
    setSaving(true)
    setError(null)
    try {
      if (editingId) {
        await api.updateRelease(artist.id, editingId, form)
      } else {
        await api.addRelease(artist.id, form)
      }
      setForm(RELEASE_INIT)
      setFormOpen(false)
      setEditingId(null)
      await onRefresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (rid) => {
    if (!window.confirm('Delete this release?')) return
    try {
      await api.deleteRelease(artist.id, rid)
      await onRefresh()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold">Release History</h2>
        <button onClick={openAdd} className="btn-success text-sm flex items-center gap-2">
          <span className="text-base leading-none">+</span>
          Add Release
        </button>
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700/50 rounded-lg px-4 py-3 text-red-300 text-sm">{error}</div>
      )}

      {/* Form */}
      {formOpen && (
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div className="text-sm font-medium text-gray-300 pb-2 border-b border-gray-800">
            {editingId ? 'Edit Release' : 'New Release'}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Title *</label>
              <input className="input-field" value={form.title} onChange={set('title')} placeholder="e.g. Midnight Drive" />
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input-field" value={form.type} onChange={set('type')}>
                {TYPE_OPTS.map(t => <option key={t} value={t}>{t || 'Select type'}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Release Date</label>
              <input type="date" className="input-field" value={form.release_date} onChange={set('release_date')} />
            </div>
            <div className="col-span-2">
              <label className="label">Platform Performance Notes</label>
              <textarea className="input-field resize-none" rows={2} value={form.performance_notes} onChange={set('performance_notes')} placeholder="Streaming numbers, chart positions, DSP features…" />
            </div>
            <div className="col-span-2">
              <label className="label">Promotional Context</label>
              <textarea className="input-field resize-none" rows={2} value={form.promotional_context} onChange={set('promotional_context')} placeholder="Campaign activity, press, syncs, live appearances around this release…" />
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" className="btn-success" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Release'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => { setFormOpen(false); setEditingId(null) }}>Cancel</button>
          </div>
        </form>
      )}

      {/* List */}
      {artist.releases?.length > 0 ? (
        <div className="space-y-3">
          {artist.releases.map(r => (
            <div key={r.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-white font-medium">{r.title}</span>
                    {r.type && (
                      <span className={`badge border text-xs ${TYPE_COLORS[r.type] || TYPE_COLORS.other}`}>{r.type}</span>
                    )}
                    {r.release_date && (
                      <span className="text-gray-500 text-xs">{r.release_date}</span>
                    )}
                  </div>
                  {r.performance_notes && (
                    <p className="text-gray-400 text-sm mt-1">{r.performance_notes}</p>
                  )}
                  {r.promotional_context && (
                    <p className="text-gray-500 text-xs mt-1 italic">{r.promotional_context}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => openEdit(r)} className="btn-ghost text-xs">Edit</button>
                  <button onClick={() => handleDelete(r.id)} className="btn-danger">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-600 text-sm py-4">No releases logged yet.</p>
      )}
    </div>
  )
}
