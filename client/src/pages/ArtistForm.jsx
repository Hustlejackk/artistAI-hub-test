import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'

const INITIAL = {
  name: '', genre: '', subgenre: '', career_stage: '', country: '', primary_market: '', bio: '',
  artistic_goals: '', visual_identity: '', moodboard_references: '', sound_references: '', what_not_to_do: '',
  competitors: '', genre_trends: '', opportunities: ''
}

export default function ArtistForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = !!id

  const [form, setForm] = useState(INITIAL)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isEdit) return
    api.getArtist(id)
      .then(artist => {
        const values = {}
        Object.keys(INITIAL).forEach(k => { values[k] = artist[k] || '' })
        setForm(values)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id, isEdit])

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Artist name is required'); return }
    setSaving(true)
    setError(null)
    try {
      const artist = isEdit
        ? await api.updateArtist(id, form)
        : await api.createArtist(form)
      navigate(`/artists/${artist.id}`)
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="text-gray-500 text-sm">Loading…</div></div>
  }

  return (
    <div className="p-8 max-w-3xl mx-auto pb-16">
      {/* Header */}
      <div className="mb-8">
        <button onClick={() => navigate(isEdit ? `/artists/${id}` : '/')} className="text-sm text-gray-500 hover:text-white mb-4 flex items-center gap-1 transition-colors">
          ← {isEdit ? 'Back to profile' : 'Back to roster'}
        </button>
        <h1 className="text-2xl font-bold text-white">{isEdit ? 'Edit Artist Profile' : 'New Artist Profile'}</h1>
        <p className="text-gray-500 text-sm mt-1">Fill in as much detail as possible — richer profiles produce better AI analysis.</p>
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700/50 rounded-lg px-4 py-3 text-red-300 text-sm mb-6">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">

        {/* ── Identity ──────────────────────────────────────────────── */}
        <Section title="Identity" subtitle="Core information about the artist">
          <div className="grid grid-cols-1 gap-4">
            <Field label="Artist Name *" required>
              <input className="input-field" value={form.name} onChange={set('name')} placeholder="e.g. Nova Ray" />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Genre">
                <input className="input-field" value={form.genre} onChange={set('genre')} placeholder="e.g. Pop" />
              </Field>
              <Field label="Subgenre">
                <input className="input-field" value={form.subgenre} onChange={set('subgenre')} placeholder="e.g. Indie Pop" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Country">
                <input className="input-field" value={form.country} onChange={set('country')} placeholder="e.g. United Kingdom" />
              </Field>
              <Field label="Primary Market">
                <input className="input-field" value={form.primary_market} onChange={set('primary_market')} placeholder="e.g. UK / Europe" />
              </Field>
            </div>

            <Field label="Career Stage">
              <select className="input-field" value={form.career_stage} onChange={set('career_stage')}>
                <option value="">Select stage</option>
                <option value="emerging">Emerging</option>
                <option value="developing">Developing</option>
                <option value="established">Established</option>
              </select>
            </Field>

            <Field label="Artist Bio">
              <textarea
                className="input-field resize-none"
                rows={4}
                value={form.bio}
                onChange={set('bio')}
                placeholder="A brief overview of the artist — background, sound, current moment…"
              />
            </Field>
          </div>
        </Section>

        {/* ── Artistic Direction ────────────────────────────────────── */}
        <Section title="Artistic Direction" subtitle="Vision, identity and creative boundaries">
          <div className="grid grid-cols-1 gap-4">
            <Field label="Artistic Goals">
              <textarea
                className="input-field resize-none"
                rows={3}
                value={form.artistic_goals}
                onChange={set('artistic_goals')}
                placeholder="What does the artist want to achieve in the next 1–2 years?"
              />
            </Field>

            <Field label="Visual Identity">
              <textarea
                className="input-field resize-none"
                rows={3}
                value={form.visual_identity}
                onChange={set('visual_identity')}
                placeholder="Aesthetic direction, colour palette, mood, styling references…"
              />
            </Field>

            <Field label="Moodboard References">
              <textarea
                className="input-field resize-none"
                rows={2}
                value={form.moodboard_references}
                onChange={set('moodboard_references')}
                placeholder="Image URLs, artist references, or text descriptions of the visual world…"
              />
            </Field>

            <Field label="Sound References">
              <textarea
                className="input-field resize-none"
                rows={2}
                value={form.sound_references}
                onChange={set('sound_references')}
                placeholder="Artists, tracks, albums, or descriptions that define the sound direction…"
              />
            </Field>

            <Field label="What the artist does NOT want">
              <textarea
                className="input-field resize-none"
                rows={2}
                value={form.what_not_to_do}
                onChange={set('what_not_to_do')}
                placeholder="Boundaries, directions to avoid, associations to steer clear of…"
              />
            </Field>
          </div>
        </Section>

        {/* ── Market Context ────────────────────────────────────────── */}
        <Section title="Market Context" subtitle="Competitive landscape and strategic environment">
          <div className="grid grid-cols-1 gap-4">
            <Field label="Reference Artists / Competitors">
              <textarea
                className="input-field resize-none"
                rows={2}
                value={form.competitors}
                onChange={set('competitors')}
                placeholder="Artists operating in the same space, or useful reference points for positioning…"
              />
            </Field>

            <Field label="Current Trends in the Genre">
              <textarea
                className="input-field resize-none"
                rows={2}
                value={form.genre_trends}
                onChange={set('genre_trends')}
                placeholder="What is happening in the genre right now? Micro-trends, dominant sounds, shifts…"
              />
            </Field>

            <Field label="Opportunities Identified">
              <textarea
                className="input-field resize-none"
                rows={2}
                value={form.opportunities}
                onChange={set('opportunities')}
                placeholder="Gaps in the market, moments to capitalise on, partnerships or platforms worth targeting…"
              />
            </Field>
          </div>
        </Section>

        {/* Submit */}
        <div className="flex items-center gap-4 pt-2">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Artist Profile'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate(isEdit ? `/artists/${id}` : '/')}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

function Section({ title, subtitle, children }) {
  return (
    <div className="card">
      <div className="mb-5">
        <h2 className="text-white font-semibold text-base">{title}</h2>
        {subtitle && <p className="text-gray-500 text-sm mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  )
}
