import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api'
import OverviewTab from './tabs/OverviewTab'
import SocialStreamingTab from './tabs/SocialStreamingTab'
import ReleasesTab from './tabs/ReleasesTab'
import PromotionsTab from './tabs/PromotionsTab'
import NotesTab from './tabs/NotesTab'
import AnalysisTab from './tabs/AnalysisTab'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'social', label: 'Social & Streaming' },
  { id: 'releases', label: 'Releases' },
  { id: 'promotions', label: 'Promotions' },
  { id: 'notes', label: 'Notes' },
  { id: 'analysis', label: 'AI Analysis' },
]

const STAGE_COLORS = {
  emerging: 'bg-blue-900/50 text-blue-300 border-blue-700/50',
  developing: 'bg-violet-900/50 text-violet-300 border-violet-700/50',
  established: 'bg-emerald-900/50 text-emerald-300 border-emerald-700/50',
}

export default function ArtistDashboard() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [artist, setArtist] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [deleting, setDeleting] = useState(false)

  const loadArtist = useCallback(() => {
    return api.getArtist(id)
      .then(setArtist)
      .catch(e => setError(e.message))
  }, [id])

  useEffect(() => {
    setLoading(true)
    loadArtist().finally(() => setLoading(false))
  }, [loadArtist])

  const handleDelete = async () => {
    if (!window.confirm(`Permanently delete ${artist.name}? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await api.deleteArtist(id)
      navigate('/')
    } catch (e) {
      alert(e.message)
      setDeleting(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="text-gray-500 text-sm">Loading artist…</div></div>
  }
  if (error) {
    return <div className="flex items-center justify-center h-full"><div className="text-red-400 text-sm">{error}</div></div>
  }
  if (!artist) return null

  const stageColor = STAGE_COLORS[artist.career_stage] || 'bg-gray-800 text-gray-400 border-gray-700'

  return (
    <div className="flex flex-col h-full">
      {/* Artist header */}
      <div className="bg-gray-900 border-b border-gray-800 px-8 pt-6 pb-0">
        <div className="max-w-6xl mx-auto">
          {/* Breadcrumb */}
          <button onClick={() => navigate('/')} className="text-sm text-gray-500 hover:text-white mb-4 flex items-center gap-1 transition-colors">
            ← All Artists
          </button>

          {/* Title row */}
          <div className="flex items-start justify-between gap-4 mb-5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-bold text-white">{artist.name}</h1>
                {artist.career_stage && (
                  <span className={`badge border ${stageColor}`}>{artist.career_stage}</span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-2 text-sm text-gray-400 flex-wrap">
                {artist.genre && <span>{artist.genre}{artist.subgenre ? ` · ${artist.subgenre}` : ''}</span>}
                {artist.country && <span className="text-gray-600">·</span>}
                {artist.country && <span>{artist.country}</span>}
                {artist.primary_market && <span className="text-gray-600">·</span>}
                {artist.primary_market && <span>{artist.primary_market}</span>}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => navigate(`/artists/${id}/edit`)}
                className="btn-secondary text-sm"
              >
                Edit Profile
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="btn-danger"
              >
                {deleting ? '…' : 'Delete'}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 -mb-px">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-white'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab.label}
                {tab.id === 'releases' && artist.releases?.length > 0 && (
                  <span className="ml-1.5 text-xs text-gray-600">({artist.releases.length})</span>
                )}
                {tab.id === 'analysis' && artist.analyses?.length > 0 && (
                  <span className="ml-1.5 text-xs text-gray-600">({artist.analyses.length})</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-8 py-6">
          {activeTab === 'overview' && <OverviewTab artist={artist} onTabChange={setActiveTab} />}
          {activeTab === 'social' && <SocialStreamingTab artist={artist} onRefresh={loadArtist} />}
          {activeTab === 'releases' && <ReleasesTab artist={artist} onRefresh={loadArtist} />}
          {activeTab === 'promotions' && <PromotionsTab artist={artist} onRefresh={loadArtist} />}
          {activeTab === 'notes' && <NotesTab artist={artist} onRefresh={loadArtist} />}
          {activeTab === 'analysis' && <AnalysisTab artist={artist} onRefresh={loadArtist} />}
        </div>
      </div>
    </div>
  )
}
