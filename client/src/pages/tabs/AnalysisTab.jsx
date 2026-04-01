import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api } from '../../api'

export default function AnalysisTab({ artist, onRefresh }) {
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [activeAnalysis, setActiveAnalysis] = useState(null)
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    setActiveAnalysis(null)
    try {
      const analysis = await api.generateAnalysis(artist.id)
      await onRefresh()
      setActiveAnalysis(analysis)
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  const loadAnalysis = async (analysisId) => {
    setLoadingAnalysis(true)
    setError(null)
    try {
      const analysis = await api.getAnalysis(artist.id, analysisId)
      setActiveAnalysis(analysis)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingAnalysis(false)
    }
  }

  const analyses = artist.analyses || []

  return (
    <div className="space-y-6">
      {/* Generate button + header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-white font-semibold">AI Analysis</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            Generates a strategic analysis using all available artist data.
            {analyses.length > 0 && ` ${analyses.length} previous ${analyses.length === 1 ? 'analysis' : 'analyses'} stored.`}
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="btn-primary shrink-0 flex items-center gap-2 min-w-[160px] justify-center"
        >
          {generating ? (
            <>
              <Spinner />
              Generating…
            </>
          ) : (
            <>
              <span>✦</span>
              Generate Analysis
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700/50 rounded-lg px-4 py-3 text-red-300 text-sm">{error}</div>
      )}

      {/* Loading state during generation */}
      {generating && (
        <div className="card text-center py-12">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-indigo-600/20 flex items-center justify-center">
              <Spinner className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <div className="text-white font-medium mb-1">Analysing {artist.name}…</div>
              <div className="text-gray-500 text-sm">Claude is reviewing all artist data and generating strategic insights.</div>
              <div className="text-gray-600 text-xs mt-2">This typically takes 20–45 seconds.</div>
            </div>
          </div>
        </div>
      )}

      {/* Active analysis */}
      {activeAnalysis && !generating && (
        <div className="card">
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-800">
            <div>
              <div className="text-white font-semibold">Strategic Analysis</div>
              <div className="text-gray-500 text-xs mt-0.5">
                Generated {fmtDate(activeAnalysis.created_at)} · {activeAnalysis.model}
              </div>
            </div>
            <button
              onClick={() => setActiveAnalysis(null)}
              className="btn-ghost text-xs"
            >
              Close
            </button>
          </div>
          <div className="prose prose-invert prose-sm max-w-none
            prose-headings:text-white prose-headings:font-semibold
            prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
            prose-p:text-gray-300 prose-p:leading-relaxed
            prose-li:text-gray-300
            prose-strong:text-white prose-strong:font-semibold
            prose-a:text-indigo-400
            prose-hr:border-gray-700
            prose-blockquote:border-indigo-500 prose-blockquote:text-gray-400
            prose-code:text-indigo-300 prose-code:bg-gray-800 prose-code:px-1 prose-code:rounded
          ">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {activeAnalysis.content}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* No analysis yet and nothing generating */}
      {!generating && !activeAnalysis && analyses.length === 0 && (
        <div className="card text-center py-12">
          <div className="text-4xl mb-4">✦</div>
          <h3 className="text-white font-medium mb-2">No analyses yet</h3>
          <p className="text-gray-500 text-sm max-w-sm mx-auto mb-6">
            Add artist data across the other tabs, then click "Generate Analysis" to get your first strategic intelligence report.
          </p>
          <div className="flex flex-wrap justify-center gap-2 text-xs text-gray-600">
            <span className="bg-gray-800 px-3 py-1 rounded-full">Social metrics</span>
            <span className="bg-gray-800 px-3 py-1 rounded-full">Streaming data</span>
            <span className="bg-gray-800 px-3 py-1 rounded-full">Release history</span>
            <span className="bg-gray-800 px-3 py-1 rounded-full">Promotion log</span>
            <span className="bg-gray-800 px-3 py-1 rounded-full">Notes</span>
          </div>
        </div>
      )}

      {/* Prompt to load latest if there are analyses but none shown */}
      {!generating && !activeAnalysis && analyses.length > 0 && (
        <div className="card flex items-center justify-between">
          <div>
            <div className="text-white font-medium text-sm">Latest Analysis</div>
            <div className="text-gray-500 text-xs mt-0.5">{fmtDate(analyses[0].created_at)}</div>
          </div>
          <button
            onClick={() => loadAnalysis(analyses[0].id)}
            disabled={loadingAnalysis}
            className="btn-secondary text-sm"
          >
            {loadingAnalysis ? 'Loading…' : 'View →'}
          </button>
        </div>
      )}

      {/* Analysis history */}
      {analyses.length > 1 && (
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-3">
            Analysis History ({analyses.length})
          </h3>
          <div className="space-y-2">
            {analyses.map((a, i) => (
              <button
                key={a.id}
                onClick={() => loadAnalysis(a.id)}
                disabled={loadingAnalysis}
                className={`w-full card text-left hover:border-gray-600 transition-colors ${
                  activeAnalysis?.id === a.id ? 'border-indigo-600/50 bg-indigo-900/10' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white text-sm font-medium">
                      Analysis #{analyses.length - i}
                      {i === 0 && <span className="ml-2 text-xs text-indigo-400">Latest</span>}
                    </div>
                    <div className="text-gray-500 text-xs mt-0.5">{fmtDate(a.created_at)} · {a.model}</div>
                  </div>
                  <span className="text-gray-600 text-sm">→</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Spinner({ className = 'w-4 h-4' }) {
  return (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}
