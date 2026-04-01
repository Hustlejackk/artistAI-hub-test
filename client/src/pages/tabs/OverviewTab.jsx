export default function OverviewTab({ artist, onTabChange }) {
  const latestSocial = artist.social_updates?.[0]
  const latestStreaming = artist.streaming_updates?.[0]
  const recentReleases = artist.releases?.slice(0, 3) || []
  const recentPromos = artist.promotions?.slice(0, 3) || []

  return (
    <div className="space-y-6">
      {/* Bio */}
      {artist.bio && (
        <div className="card">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Bio</div>
          <p className="text-gray-300 text-sm leading-relaxed">{artist.bio}</p>
        </div>
      )}

      {/* Metrics row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Social snapshot */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white text-sm">Social Media</h3>
            {latestSocial ? (
              <span className="text-xs text-gray-600">{fmtDate(latestSocial.recorded_at)}</span>
            ) : (
              <button onClick={() => onTabChange('social')} className="text-xs text-indigo-400 hover:text-indigo-300">Add data →</button>
            )}
          </div>
          {latestSocial ? (
            <div className="space-y-3">
              {latestSocial.instagram_followers && (
                <PlatformRow
                  platform="Instagram"
                  main={fmtNum(latestSocial.instagram_followers) + ' followers'}
                  sub={latestSocial.instagram_engagement ? `${latestSocial.instagram_engagement}% engagement` : null}
                  trend={latestSocial.instagram_trend}
                />
              )}
              {latestSocial.tiktok_followers && (
                <PlatformRow
                  platform="TikTok"
                  main={fmtNum(latestSocial.tiktok_followers) + ' followers'}
                  sub={latestSocial.tiktok_avg_views ? `${fmtNum(latestSocial.tiktok_avg_views)} avg views` : null}
                  trend={latestSocial.tiktok_trend}
                />
              )}
              {latestSocial.youtube_subscribers && (
                <PlatformRow
                  platform="YouTube"
                  main={fmtNum(latestSocial.youtube_subscribers) + ' subscribers'}
                  sub={latestSocial.youtube_avg_views ? `${fmtNum(latestSocial.youtube_avg_views)} avg views` : null}
                  trend={latestSocial.youtube_trend}
                />
              )}
              {!latestSocial.instagram_followers && !latestSocial.tiktok_followers && !latestSocial.youtube_subscribers && (
                <p className="text-gray-600 text-sm">No platform data in latest snapshot</p>
              )}
            </div>
          ) : (
            <p className="text-gray-600 text-sm">No social data yet.</p>
          )}
        </div>

        {/* Streaming snapshot */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white text-sm">Streaming</h3>
            {latestStreaming ? (
              <span className="text-xs text-gray-600">{fmtDate(latestStreaming.recorded_at)}</span>
            ) : (
              <button onClick={() => onTabChange('social')} className="text-xs text-indigo-400 hover:text-indigo-300">Add data →</button>
            )}
          </div>
          {latestStreaming ? (
            <div className="space-y-3">
              {latestStreaming.spotify_monthly_listeners && (
                <PlatformRow
                  platform="Spotify"
                  main={fmtNum(latestStreaming.spotify_monthly_listeners) + ' monthly listeners'}
                  sub={latestStreaming.spotify_top_markets}
                />
              )}
              {latestStreaming.spotify_playlist_placements && (
                <div className="text-sm">
                  <span className="text-gray-500 text-xs block mb-0.5">Playlists</span>
                  <span className="text-gray-300">{latestStreaming.spotify_playlist_placements}</span>
                </div>
              )}
              <div className="text-sm flex items-center gap-2">
                <span className="text-gray-500 text-xs">Apple Music</span>
                <span className={latestStreaming.apple_music_presence ? 'text-emerald-400' : 'text-gray-600'}>
                  {latestStreaming.apple_music_presence ? '✓ Active' : 'Not active'}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-gray-600 text-sm">No streaming data yet.</p>
          )}
        </div>
      </div>

      {/* Artistic direction */}
      {(artist.artistic_goals || artist.visual_identity || artist.sound_references || artist.what_not_to_do) && (
        <div className="card">
          <h3 className="font-semibold text-white text-sm mb-4">Artistic Direction</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {artist.artistic_goals && (
              <InfoBlock label="Goals" value={artist.artistic_goals} />
            )}
            {artist.visual_identity && (
              <InfoBlock label="Visual Identity" value={artist.visual_identity} />
            )}
            {artist.sound_references && (
              <InfoBlock label="Sound References" value={artist.sound_references} />
            )}
            {artist.what_not_to_do && (
              <InfoBlock label="What NOT to do" value={artist.what_not_to_do} />
            )}
          </div>
        </div>
      )}

      {/* Recent releases & promotions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-white text-sm">Recent Releases</h3>
            {artist.releases?.length > 0 && (
              <button onClick={() => onTabChange('releases')} className="text-xs text-indigo-400 hover:text-indigo-300">View all →</button>
            )}
          </div>
          {recentReleases.length > 0 ? (
            <div className="space-y-2">
              {recentReleases.map(r => (
                <div key={r.id} className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0">
                  <div>
                    <div className="text-white text-sm font-medium">{r.title}</div>
                    <div className="text-gray-500 text-xs">{r.type} · {r.release_date || 'TBD'}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-sm">No releases logged.</p>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-white text-sm">Recent Promotions</h3>
            {artist.promotions?.length > 0 && (
              <button onClick={() => onTabChange('promotions')} className="text-xs text-indigo-400 hover:text-indigo-300">View all →</button>
            )}
          </div>
          {recentPromos.length > 0 ? (
            <div className="space-y-2">
              {recentPromos.map(p => (
                <div key={p.id} className="py-1.5 border-b border-gray-800 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="badge bg-gray-800 text-gray-400">{p.type || 'general'}</span>
                    <span className="text-gray-500 text-xs">{p.date}</span>
                  </div>
                  <div className="text-gray-300 text-sm mt-1 truncate">{p.description}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-sm">No promotions logged.</p>
          )}
        </div>
      </div>

      {/* Market context */}
      {(artist.competitors || artist.genre_trends || artist.opportunities) && (
        <div className="card">
          <h3 className="font-semibold text-white text-sm mb-4">Market Context</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {artist.competitors && <InfoBlock label="Reference Artists" value={artist.competitors} />}
            {artist.genre_trends && <InfoBlock label="Genre Trends" value={artist.genre_trends} />}
            {artist.opportunities && <InfoBlock label="Opportunities" value={artist.opportunities} />}
          </div>
        </div>
      )}

      {/* Analyses history count */}
      {artist.analyses?.length > 0 && (
        <div className="card flex items-center justify-between">
          <div>
            <div className="text-white font-medium text-sm">{artist.analyses.length} AI {artist.analyses.length === 1 ? 'Analysis' : 'Analyses'} generated</div>
            <div className="text-gray-500 text-xs mt-0.5">Latest: {fmtDate(artist.analyses[0].created_at)}</div>
          </div>
          <button onClick={() => onTabChange('analysis')} className="btn-primary text-sm">
            View Analysis →
          </button>
        </div>
      )}
    </div>
  )
}

function PlatformRow({ platform, main, sub, trend }) {
  const trendColor = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-gray-500'
  const trendSymbol = trend === 'up' ? '↑' : trend === 'down' ? '↓' : trend === 'stable' ? '→' : ''

  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-xs text-gray-500 mb-0.5">{platform}</div>
        <div className="text-white text-sm font-medium">{main}</div>
        {sub && <div className="text-gray-400 text-xs">{sub}</div>}
      </div>
      {trendSymbol && <span className={`text-sm font-medium ${trendColor}`}>{trendSymbol}</span>}
    </div>
  )
}

function InfoBlock({ label, value }) {
  return (
    <div>
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{label}</div>
      <p className="text-gray-300 text-sm leading-relaxed">{value}</p>
    </div>
  )
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
