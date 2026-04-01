import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

const STAGE_COLORS = {
  emerging: 'bg-blue-900/50 text-blue-300 border-blue-700/50',
  developing: 'bg-violet-900/50 text-violet-300 border-violet-700/50',
  established: 'bg-emerald-900/50 text-emerald-300 border-emerald-700/50',
}

export default function ArtistList() {
  const [artists, setArtists] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    api.getArtists()
      .then(setArtists)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500 text-sm">Loading artists…</div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Artist Roster</h1>
          <p className="text-gray-500 text-sm mt-1">{artists.length} artist{artists.length !== 1 ? 's' : ''} in your roster</p>
        </div>
        <button onClick={() => navigate('/artists/new')} className="btn-primary flex items-center gap-2">
          <span className="text-lg leading-none">+</span>
          Add Artist
        </button>
      </div>

      {/* Empty state */}
      {artists.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
            <span className="text-3xl">🎵</span>
          </div>
          <h2 className="text-white font-semibold text-lg mb-2">No artists yet</h2>
          <p className="text-gray-500 text-sm max-w-sm mb-6">
            Start building your roster by creating your first artist profile.
          </p>
          <button onClick={() => navigate('/artists/new')} className="btn-primary">
            Create First Artist
          </button>
        </div>
      )}

      {/* Artist grid */}
      {artists.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {artists.map(artist => (
            <ArtistCard key={artist.id} artist={artist} onClick={() => navigate(`/artists/${artist.id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}

function ArtistCard({ artist, onClick }) {
  const stageColor = STAGE_COLORS[artist.career_stage] || 'bg-gray-800 text-gray-400 border-gray-700'
  const updatedAt = artist.updated_at ? new Date(artist.updated_at) : null

  return (
    <button
      onClick={onClick}
      className="card text-left hover:border-gray-600 hover:bg-gray-800/50 transition-all cursor-pointer w-full"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-white font-semibold text-lg truncate">{artist.name}</h2>
          {artist.genre && (
            <p className="text-gray-400 text-sm mt-0.5">
              {artist.genre}{artist.subgenre ? ` · ${artist.subgenre}` : ''}
            </p>
          )}
        </div>
        {artist.career_stage && (
          <span className={`badge border ml-2 shrink-0 ${stageColor}`}>
            {artist.career_stage}
          </span>
        )}
      </div>

      {/* Bio excerpt */}
      {artist.bio && (
        <p className="text-gray-500 text-sm line-clamp-2 mb-4">{artist.bio}</p>
      )}

      {/* Metrics row */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {artist.latest_instagram_followers != null && (
          <Metric label="Instagram" value={formatNum(artist.latest_instagram_followers)} />
        )}
        {artist.latest_spotify_listeners != null && (
          <Metric label="Spotify" value={formatNum(artist.latest_spotify_listeners) + '/mo'} />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-800">
        <div className="flex items-center gap-3 text-xs text-gray-600">
          {artist.release_count > 0 && (
            <span>{artist.release_count} release{artist.release_count !== 1 ? 's' : ''}</span>
          )}
          {artist.analysis_count > 0 && (
            <span>{artist.analysis_count} analysis{artist.analysis_count !== 1 ? 'es' : ''}</span>
          )}
          {artist.country && <span>{artist.country}</span>}
        </div>
        {updatedAt && (
          <span className="text-xs text-gray-700">
            {updatedAt.toLocaleDateString()}
          </span>
        )}
      </div>
    </button>
  )
}

function Metric({ label, value }) {
  return (
    <div className="bg-gray-800/60 rounded-lg px-3 py-2">
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className="text-white text-sm font-medium">{value}</div>
    </div>
  )
}

function formatNum(n) {
  if (!n) return '—'
  n = Number(n)
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}
