import { useState } from 'react'
import { api } from '../../api'

const PROMO_INIT = { date: '', type: '', description: '', result: '' }
const TYPE_OPTS = ['', 'press', 'playlist pitch', 'sync', 'live', 'social campaign', 'partnership', 'radio', 'other']

const TYPE_COLORS = {
  'press': 'bg-blue-900/40 text-blue-300 border-blue-700/40',
  'playlist pitch': 'bg-emerald-900/40 text-emerald-300 border-emerald-700/40',
  'sync': 'bg-amber-900/40 text-amber-300 border-amber-700/40',
  'live': 'bg-violet-900/40 text-violet-300 border-violet-700/40',
  'social campaign': 'bg-pink-900/40 text-pink-300 border-pink-700/40',
  'partnership': 'bg-cyan-900/40 text-cyan-300 border-cyan-700/40',
  'radio': 'bg-orange-900/40 text-orange-300 border-orange-700/40',
  'other': 'bg-gray-800 text-gray-400 border-gray-700',
}

export default function PromotionsTab({ artist, onRefresh }) {
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(PROMO_INIT)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [typeFilter, setTypeFilter] = useState('')

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const openAdd = () => {
    setForm(PROMO_INIT)
    setEditingId(null)
    setFormOpen(true)
  }

  const openEdit = (promo) => {
    setForm({
      date: promo.date || '',
      type: promo.type || '',
      description: promo.description || '',
      result: promo.result || ''
    })
    setEditingId(promo.id)
    setFormOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.description.trim()) { setError('Description is required'); return }
    setSaving(true)
    setError(null)
    try {
      if (editingId) {
        await api.updatePromotion(artist.id, editingId, form)
      } else {
        await api.addPromotion(artist.id, form)
      }
      setForm(PROMO_INIT)
      setFormOpen(false)
      setEditingId(null)
      await onRefresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (pid) => {
    if (!window.confirm('Delete this promotion entry?')) return
    try {
      await api.deletePromotion(artist.id, pid)
      await onRefresh()
    } catch (err) {
      setError(err.message)
    }
  }

  const allTypes = [...new Set((artist.promotions || []).map(p => p.type).filter(Boolean))]
  const filtered = typeFilter
    ? (artist.promotions || []).filter(p => p.type === typeFilter)
    : (artist.promotions || [])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold">Promotion Log</h2>
        <button onClick={openAdd} className="btn-success text-sm flex items-center gap-2">
          <span className="text-base leading-none">+</span>
          Log Activity
        </button>
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700/50 rounded-lg px-4 py-3 text-red-300 text-sm">{error}</div>
      )}

      {/* Form */}
      {formOpen && (
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div className="text-sm font-medium text-gray-300 pb-2 border-b border-gray-800">
            {editingId ? 'Edit Promotion Entry' : 'New Promotion Activity'}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Date</label>
              <input type="date" className="input-field" value={form.date} onChange={set('date')} />
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input-field" value={form.type} onChange={set('type')}>
                {TYPE_OPTS.map(t => <option key={t} value={t}>{t || 'Select type'}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Description *</label>
              <textarea
                className="input-field resize-none"
                rows={3}
                value={form.description}
                onChange={set('description')}
                placeholder="What was done — campaign details, outlet, placement, context…"
              />
            </div>
            <div className="col-span-2">
              <label className="label">Result / Outcome</label>
              <textarea
                className="input-field resize-none"
                rows={2}
                value={form.result}
                onChange={set('result')}
                placeholder="What happened — reach, streams, press mentions, conversions…"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" className="btn-success" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Log Activity'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => { setFormOpen(false); setEditingId(null) }}>Cancel</button>
          </div>
        </form>
      )}

      {/* Filter */}
      {allTypes.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Filter:</span>
          <button
            onClick={() => setTypeFilter('')}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              !typeFilter ? 'bg-indigo-600/30 text-indigo-300 border-indigo-600/50' : 'border-gray-700 text-gray-500 hover:text-gray-300'
            }`}
          >
            All
          </button>
          {allTypes.map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(typeFilter === t ? '' : t)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                typeFilter === t ? 'bg-indigo-600/30 text-indigo-300 border-indigo-600/50' : 'border-gray-700 text-gray-500 hover:text-gray-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map(p => (
            <div key={p.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    {p.type && (
                      <span className={`badge border text-xs ${TYPE_COLORS[p.type] || TYPE_COLORS.other}`}>{p.type}</span>
                    )}
                    {p.date && <span className="text-gray-500 text-xs">{p.date}</span>}
                  </div>
                  <p className="text-gray-200 text-sm">{p.description}</p>
                  {p.result && (
                    <div className="mt-2 pl-3 border-l-2 border-gray-700">
                      <span className="text-xs text-gray-500">Result: </span>
                      <span className="text-gray-400 text-sm">{p.result}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => openEdit(p)} className="btn-ghost text-xs">Edit</button>
                  <button onClick={() => handleDelete(p.id)} className="btn-danger">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-600 text-sm py-4">
          {typeFilter ? `No "${typeFilter}" activities logged.` : 'No promotional activities logged yet.'}
        </p>
      )}
    </div>
  )
}
