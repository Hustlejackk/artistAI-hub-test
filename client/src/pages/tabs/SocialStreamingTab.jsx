import { useState } from 'react'
import { api } from '../../api'

const TREND_OPTS = ['', 'up', 'stable', 'down']

const SOCIAL_INIT = {
  instagram_followers: '', instagram_engagement: '', instagram_trend: '',
  tiktok_followers: '', tiktok_avg_views: '', tiktok_trend: '',
  youtube_subscribers: '', youtube_avg_views: '', youtube_trend: '',
  other_platforms: '', notes: ''
}

const STREAMING_INIT = {
  spotify_monthly_listeners: '', spotify_top_markets: '', spotify_playlist_placements: '',
  apple_music_presence: false, apple_music_placements: '', other_dsps: '', notes: ''
}

export default function SocialStreamingTab({ artist, onRefresh }) {
  const [socialOpen, setSocialOpen] = useState(false)
  const [streamingOpen, setStreamingOpen] = useState(false)
  const [socialForm, setSocialForm] = useState(SOCIAL_INIT)
  const [streamingForm, setStreamingForm] = useState(STREAMING_INIT)
  const [savingSocial, setSavingSocial] = useState(false)
  const [savingStreaming, setSavingStreaming] = useState(false)
  const [error, setError] = useState(null)

  const setSocial = (field) => (e) => setSocialForm(f => ({ ...f, [field]: e.target.value }))
  const setStream = (field) => (e) => setStreamingForm(f => ({
    ...f, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value
  }))

  const submitSocial = async (e) => {
    e.preventDefault()
    setSavingSocial(true)
    setError(null)
    try {
      await api.addSocial(artist.id, socialForm)
      setSocialForm(SOCIAL_INIT)
      setSocialOpen(false)
      await onRefresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingSocial(false)
    }
  }

  const submitStreaming = async (e) => {
    e.preventDefault()
    setSavingStreaming(true)
    setError(null)
    try {
      await api.addStreaming(artist.id, streamingForm)
      setStreamingForm(STREAMING_INIT)
      setStreamingOpen(false)
      await onRefresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingStreaming(false)
    }
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-900/40 border border-red-700/50 rounded-lg px-4 py-3 text-red-300 text-sm">{error}</div>
      )}

      {/* ── Social Media ──────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">Social Media</h2>
          <button
            onClick={() => setSocialOpen(o => !o)}
            className="btn-success text-sm flex items-center gap-2"
          >
            <span className="text-base leading-none">+</span>
            {socialOpen ? 'Cancel' : 'Add Snapshot'}
          </button>
        </div>

        {/* Social form */}
        {socialOpen && (
          <form onSubmit={submitSocial} className="card mb-5 space-y-5">
            <div className="text-sm font-medium text-gray-300 pb-2 border-b border-gray-800">New Social Media Snapshot</div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label">Instagram Followers</label>
                <input type="number" className="input-field" value={socialForm.instagram_followers} onChange={setSocial('instagram_followers')} placeholder="125000" />
              </div>
              <div>
                <label className="label">Engagement Rate %</label>
                <input type="number" step="0.1" className="input-field" value={socialForm.instagram_engagement} onChange={setSocial('instagram_engagement')} placeholder="3.2" />
              </div>
              <div>
                <label className="label">Trend</label>
                <TrendSelect value={socialForm.instagram_trend} onChange={setSocial('instagram_trend')} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label">TikTok Followers</label>
                <input type="number" className="input-field" value={socialForm.tiktok_followers} onChange={setSocial('tiktok_followers')} placeholder="89000" />
              </div>
              <div>
                <label className="label">Avg Views / Video</label>
                <input type="number" className="input-field" value={socialForm.tiktok_avg_views} onChange={setSocial('tiktok_avg_views')} placeholder="45000" />
              </div>
              <div>
                <label className="label">Trend</label>
                <TrendSelect value={socialForm.tiktok_trend} onChange={setSocial('tiktok_trend')} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label">YouTube Subscribers</label>
                <input type="number" className="input-field" value={socialForm.youtube_subscribers} onChange={setSocial('youtube_subscribers')} placeholder="32000" />
              </div>
              <div>
                <label className="label">Avg Views / Video</label>
                <input type="number" className="input-field" value={socialForm.youtube_avg_views} onChange={setSocial('youtube_avg_views')} placeholder="12000" />
              </div>
              <div>
                <label className="label">Trend</label>
                <TrendSelect value={socialForm.youtube_trend} onChange={setSocial('youtube_trend')} />
              </div>
            </div>

            <div>
              <label className="label">Other Platforms</label>
              <input className="input-field" value={socialForm.other_platforms} onChange={setSocial('other_platforms')} placeholder="Twitter: 12K · Facebook: 8K" />
            </div>

            <div>
              <label className="label">Notes</label>
              <textarea className="input-field resize-none" rows={2} value={socialForm.notes} onChange={setSocial('notes')} placeholder="Context, observations, anomalies…" />
            </div>

            <div className="flex gap-3">
              <button type="submit" className="btn-success" disabled={savingSocial}>
                {savingSocial ? 'Saving…' : 'Save Snapshot'}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setSocialOpen(false)}>Cancel</button>
            </div>
          </form>
        )}

        {/* Social history */}
        {artist.social_updates?.length > 0 ? (
          <div className="space-y-3">
            {artist.social_updates.map((s, i) => (
              <div key={s.id} className="card">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-500">{fmtDate(s.recorded_at)}</span>
                  {i === 0 && <span className="badge bg-indigo-900/50 text-indigo-300 border border-indigo-700/50 text-xs">Latest</span>}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {s.instagram_followers && (
                    <MetricCell label="Instagram" value={fmtNum(s.instagram_followers)} sub={s.instagram_engagement ? `${s.instagram_engagement}% eng.` : null} trend={s.instagram_trend} />
                  )}
                  {s.tiktok_followers && (
                    <MetricCell label="TikTok" value={fmtNum(s.tiktok_followers)} sub={s.tiktok_avg_views ? `${fmtNum(s.tiktok_avg_views)} avg` : null} trend={s.tiktok_trend} />
                  )}
                  {s.youtube_subscribers && (
                    <MetricCell label="YouTube" value={fmtNum(s.youtube_subscribers)} sub={s.youtube_avg_views ? `${fmtNum(s.youtube_avg_views)} avg` : null} trend={s.youtube_trend} />
                  )}
                </div>
                {s.notes && <p className="text-gray-500 text-xs mt-3 italic">{s.notes}</p>}
                {s.other_platforms && <p className="text-gray-500 text-xs mt-1">{s.other_platforms}</p>}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="No social media data yet. Add your first snapshot." />
        )}
      </section>

      {/* ── Streaming ─────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">Streaming</h2>
          <button
            onClick={() => setStreamingOpen(o => !o)}
            className="btn-success text-sm flex items-center gap-2"
          >
            <span className="text-base leading-none">+</span>
            {streamingOpen ? 'Cancel' : 'Add Snapshot'}
          </button>
        </div>

        {/* Streaming form */}
        {streamingOpen && (
          <form onSubmit={submitStreaming} className="card mb-5 space-y-4">
            <div className="text-sm font-medium text-gray-300 pb-2 border-b border-gray-800">New Streaming Snapshot</div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Spotify Monthly Listeners</label>
                <input type="number" className="input-field" value={streamingForm.spotify_monthly_listeners} onChange={setStream('spotify_monthly_listeners')} placeholder="250000" />
              </div>
              <div>
                <label className="label">Spotify Top Markets</label>
                <input className="input-field" value={streamingForm.spotify_top_markets} onChange={setStream('spotify_top_markets')} placeholder="UK, US, Australia" />
              </div>
            </div>

            <div>
              <label className="label">Playlist Placements</label>
              <input className="input-field" value={streamingForm.spotify_playlist_placements} onChange={setStream('spotify_playlist_placements')} placeholder="New Music Friday UK, Indie Hits…" />
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded accent-indigo-600"
                  checked={streamingForm.apple_music_presence}
                  onChange={setStream('apple_music_presence')}
                />
                <span className="text-sm text-gray-300">Apple Music active</span>
              </label>
            </div>

            {streamingForm.apple_music_presence && (
              <div>
                <label className="label">Apple Music Placements</label>
                <input className="input-field" value={streamingForm.apple_music_placements} onChange={setStream('apple_music_placements')} placeholder="A-List Pop, New Music Daily…" />
              </div>
            )}

            <div>
              <label className="label">Other DSPs</label>
              <input className="input-field" value={streamingForm.other_dsps} onChange={setStream('other_dsps')} placeholder="Amazon Music: editorial pick · Deezer: present" />
            </div>

            <div>
              <label className="label">Notes</label>
              <textarea className="input-field resize-none" rows={2} value={streamingForm.notes} onChange={setStream('notes')} placeholder="Context, observations…" />
            </div>

            <div className="flex gap-3">
              <button type="submit" className="btn-success" disabled={savingStreaming}>
                {savingStreaming ? 'Saving…' : 'Save Snapshot'}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setStreamingOpen(false)}>Cancel</button>
            </div>
          </form>
        )}

        {/* Streaming history */}
        {artist.streaming_updates?.length > 0 ? (
          <div className="space-y-3">
            {artist.streaming_updates.map((s, i) => (
              <div key={s.id} className="card">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-500">{fmtDate(s.recorded_at)}</span>
                  {i === 0 && <span className="badge bg-indigo-900/50 text-indigo-300 border border-indigo-700/50 text-xs">Latest</span>}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {s.spotify_monthly_listeners && (
                    <MetricCell label="Spotify Listeners" value={fmtNum(s.spotify_monthly_listeners) + '/mo'} sub={s.spotify_top_markets} />
                  )}
                  <MetricCell
                    label="Apple Music"
                    value={s.apple_music_presence ? 'Active' : 'Not active'}
                    valueClass={s.apple_music_presence ? 'text-emerald-400' : 'text-gray-600'}
                  />
                </div>
                {s.spotify_playlist_placements && (
                  <div className="mt-3">
                    <div className="text-xs text-gray-500 mb-1">Playlists</div>
                    <p className="text-gray-300 text-sm">{s.spotify_playlist_placements}</p>
                  </div>
                )}
                {s.notes && <p className="text-gray-500 text-xs mt-2 italic">{s.notes}</p>}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="No streaming data yet. Add your first snapshot." />
        )}
      </section>
    </div>
  )
}

function TrendSelect({ value, onChange }) {
  return (
    <select className="input-field" value={value} onChange={onChange}>
      <option value="">Select</option>
      <option value="up">↑ Up</option>
      <option value="stable">→ Stable</option>
      <option value="down">↓ Down</option>
    </select>
  )
}

function MetricCell({ label, value, sub, trend, valueClass }) {
  const trendColor = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-gray-500'
  const trendSymbol = trend === 'up' ? '↑' : trend === 'down' ? '↓' : trend === 'stable' ? '→' : ''
  return (
    <div className="bg-gray-800/50 rounded-lg px-3 py-2.5">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`font-medium text-sm flex items-center gap-1 ${valueClass || 'text-white'}`}>
        {value}
        {trendSymbol && <span className={`text-xs ${trendColor}`}>{trendSymbol}</span>}
      </div>
      {sub && <div className="text-gray-500 text-xs mt-0.5 truncate">{sub}</div>}
    </div>
  )
}

function EmptyState({ message }) {
  return <p className="text-gray-600 text-sm py-4">{message}</p>
}

function fmtNum(n) {
  n = Number(n)
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
