require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'artists.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ────────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS artists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    genre TEXT,
    subgenre TEXT,
    career_stage TEXT,
    country TEXT,
    primary_market TEXT,
    bio TEXT,
    artistic_goals TEXT,
    visual_identity TEXT,
    moodboard_references TEXT,
    sound_references TEXT,
    what_not_to_do TEXT,
    competitors TEXT,
    genre_trends TEXT,
    opportunities TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS social_media_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artist_id INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    instagram_followers INTEGER,
    instagram_engagement REAL,
    instagram_trend TEXT,
    tiktok_followers INTEGER,
    tiktok_avg_views INTEGER,
    tiktok_trend TEXT,
    youtube_subscribers INTEGER,
    youtube_avg_views INTEGER,
    youtube_trend TEXT,
    other_platforms TEXT,
    notes TEXT,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS streaming_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artist_id INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    spotify_monthly_listeners INTEGER,
    spotify_top_markets TEXT,
    spotify_playlist_placements TEXT,
    apple_music_presence INTEGER DEFAULT 0,
    apple_music_placements TEXT,
    other_dsps TEXT,
    notes TEXT,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS releases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artist_id INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT,
    release_date TEXT,
    performance_notes TEXT,
    promotional_context TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS promotion_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artist_id INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    date TEXT,
    type TEXT,
    description TEXT,
    result TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artist_id INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artist_id INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    model TEXT,
    data_snapshot TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

app.use(cors());
app.use(express.json());

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', apiKeyConfigured: !!process.env.ANTHROPIC_API_KEY });
});

// ── Artists ───────────────────────────────────────────────────────────────────
app.get('/api/artists', (req, res) => {
  const artists = db.prepare(`
    SELECT a.*,
      (SELECT COUNT(*) FROM releases WHERE artist_id = a.id) as release_count,
      (SELECT COUNT(*) FROM analyses WHERE artist_id = a.id) as analysis_count,
      (SELECT recorded_at FROM social_media_updates WHERE artist_id = a.id ORDER BY recorded_at DESC LIMIT 1) as last_social_update,
      (SELECT instagram_followers FROM social_media_updates WHERE artist_id = a.id ORDER BY recorded_at DESC LIMIT 1) as latest_instagram_followers,
      (SELECT spotify_monthly_listeners FROM streaming_updates WHERE artist_id = a.id ORDER BY recorded_at DESC LIMIT 1) as latest_spotify_listeners
    FROM artists a
    ORDER BY a.updated_at DESC
  `).all();
  res.json(artists);
});

const ARTIST_FIELDS = [
  'name', 'genre', 'subgenre', 'career_stage', 'country', 'primary_market',
  'bio', 'artistic_goals', 'visual_identity', 'moodboard_references',
  'sound_references', 'what_not_to_do', 'competitors', 'genre_trends', 'opportunities'
];

app.post('/api/artists', (req, res) => {
  const stmt = db.prepare(`
    INSERT INTO artists (${ARTIST_FIELDS.join(', ')})
    VALUES (${ARTIST_FIELDS.map(() => '?').join(', ')})
  `);
  const result = stmt.run(...ARTIST_FIELDS.map(f => req.body[f] || null));
  const artist = db.prepare('SELECT * FROM artists WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(artist);
});

app.get('/api/artists/:id', (req, res) => {
  const { id } = req.params;
  const artist = db.prepare('SELECT * FROM artists WHERE id = ?').get(id);
  if (!artist) return res.status(404).json({ error: 'Artist not found' });

  artist.social_updates = db.prepare(
    'SELECT * FROM social_media_updates WHERE artist_id = ? ORDER BY recorded_at DESC'
  ).all(id);
  artist.streaming_updates = db.prepare(
    'SELECT * FROM streaming_updates WHERE artist_id = ? ORDER BY recorded_at DESC'
  ).all(id);
  artist.releases = db.prepare(
    'SELECT * FROM releases WHERE artist_id = ? ORDER BY release_date DESC, created_at DESC'
  ).all(id);
  artist.promotions = db.prepare(
    'SELECT * FROM promotion_log WHERE artist_id = ? ORDER BY date DESC, created_at DESC'
  ).all(id);
  artist.notes = db.prepare(
    'SELECT * FROM notes WHERE artist_id = ? ORDER BY created_at DESC'
  ).all(id);
  artist.analyses = db.prepare(
    'SELECT id, created_at, model FROM analyses WHERE artist_id = ? ORDER BY created_at DESC'
  ).all(id);

  res.json(artist);
});

app.put('/api/artists/:id', (req, res) => {
  const { id } = req.params;
  db.prepare(`
    UPDATE artists SET ${ARTIST_FIELDS.map(f => `${f} = ?`).join(', ')},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(...ARTIST_FIELDS.map(f => req.body[f] || null), id);
  const artist = db.prepare('SELECT * FROM artists WHERE id = ?').get(id);
  res.json(artist);
});

app.delete('/api/artists/:id', (req, res) => {
  db.prepare('DELETE FROM artists WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── Social Media ──────────────────────────────────────────────────────────────
app.post('/api/artists/:id/social', (req, res) => {
  const {
    instagram_followers, instagram_engagement, instagram_trend,
    tiktok_followers, tiktok_avg_views, tiktok_trend,
    youtube_subscribers, youtube_avg_views, youtube_trend,
    other_platforms, notes
  } = req.body;

  const result = db.prepare(`
    INSERT INTO social_media_updates
      (artist_id, instagram_followers, instagram_engagement, instagram_trend,
       tiktok_followers, tiktok_avg_views, tiktok_trend,
       youtube_subscribers, youtube_avg_views, youtube_trend,
       other_platforms, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.params.id,
    instagram_followers || null, instagram_engagement || null, instagram_trend || null,
    tiktok_followers || null, tiktok_avg_views || null, tiktok_trend || null,
    youtube_subscribers || null, youtube_avg_views || null, youtube_trend || null,
    other_platforms || null, notes || null
  );

  touchArtist(req.params.id);
  res.status(201).json(db.prepare('SELECT * FROM social_media_updates WHERE id = ?').get(result.lastInsertRowid));
});

// ── Streaming ─────────────────────────────────────────────────────────────────
app.post('/api/artists/:id/streaming', (req, res) => {
  const {
    spotify_monthly_listeners, spotify_top_markets, spotify_playlist_placements,
    apple_music_presence, apple_music_placements, other_dsps, notes
  } = req.body;

  const result = db.prepare(`
    INSERT INTO streaming_updates
      (artist_id, spotify_monthly_listeners, spotify_top_markets, spotify_playlist_placements,
       apple_music_presence, apple_music_placements, other_dsps, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.params.id,
    spotify_monthly_listeners || null, spotify_top_markets || null,
    spotify_playlist_placements || null, apple_music_presence ? 1 : 0,
    apple_music_placements || null, other_dsps || null, notes || null
  );

  touchArtist(req.params.id);
  res.status(201).json(db.prepare('SELECT * FROM streaming_updates WHERE id = ?').get(result.lastInsertRowid));
});

// ── Releases ──────────────────────────────────────────────────────────────────
app.post('/api/artists/:id/releases', (req, res) => {
  const { title, type, release_date, performance_notes, promotional_context } = req.body;
  const result = db.prepare(`
    INSERT INTO releases (artist_id, title, type, release_date, performance_notes, promotional_context)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.params.id, title, type || null, release_date || null, performance_notes || null, promotional_context || null);
  touchArtist(req.params.id);
  res.status(201).json(db.prepare('SELECT * FROM releases WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/artists/:id/releases/:rid', (req, res) => {
  const { title, type, release_date, performance_notes, promotional_context } = req.body;
  db.prepare(`
    UPDATE releases SET title=?, type=?, release_date=?, performance_notes=?, promotional_context=?
    WHERE id=? AND artist_id=?
  `).run(title, type || null, release_date || null, performance_notes || null, promotional_context || null, req.params.rid, req.params.id);
  res.json(db.prepare('SELECT * FROM releases WHERE id = ?').get(req.params.rid));
});

app.delete('/api/artists/:id/releases/:rid', (req, res) => {
  db.prepare('DELETE FROM releases WHERE id=? AND artist_id=?').run(req.params.rid, req.params.id);
  res.json({ success: true });
});

// ── Promotions ────────────────────────────────────────────────────────────────
app.post('/api/artists/:id/promotions', (req, res) => {
  const { date, type, description, result: outcome } = req.body;
  const r = db.prepare(`
    INSERT INTO promotion_log (artist_id, date, type, description, result)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.params.id, date || null, type || null, description || null, outcome || null);
  touchArtist(req.params.id);
  res.status(201).json(db.prepare('SELECT * FROM promotion_log WHERE id = ?').get(r.lastInsertRowid));
});

app.put('/api/artists/:id/promotions/:pid', (req, res) => {
  const { date, type, description, result: outcome } = req.body;
  db.prepare(`
    UPDATE promotion_log SET date=?, type=?, description=?, result=?
    WHERE id=? AND artist_id=?
  `).run(date || null, type || null, description || null, outcome || null, req.params.pid, req.params.id);
  res.json(db.prepare('SELECT * FROM promotion_log WHERE id = ?').get(req.params.pid));
});

app.delete('/api/artists/:id/promotions/:pid', (req, res) => {
  db.prepare('DELETE FROM promotion_log WHERE id=? AND artist_id=?').run(req.params.pid, req.params.id);
  res.json({ success: true });
});

// ── Notes ─────────────────────────────────────────────────────────────────────
app.post('/api/artists/:id/notes', (req, res) => {
  const { content } = req.body;
  const result = db.prepare('INSERT INTO notes (artist_id, content) VALUES (?, ?)').run(req.params.id, content);
  touchArtist(req.params.id);
  res.status(201).json(db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid));
});

app.delete('/api/artists/:id/notes/:nid', (req, res) => {
  db.prepare('DELETE FROM notes WHERE id=? AND artist_id=?').run(req.params.nid, req.params.id);
  res.json({ success: true });
});

// ── AI Analysis ───────────────────────────────────────────────────────────────
app.post('/api/artists/:id/analyze', async (req, res) => {
  const { id } = req.params;

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(400).json({
      error: 'ANTHROPIC_API_KEY not configured. Create a server/.env file with your key.'
    });
  }

  const artist = db.prepare('SELECT * FROM artists WHERE id = ?').get(id);
  if (!artist) return res.status(404).json({ error: 'Artist not found' });

  const social = db.prepare('SELECT * FROM social_media_updates WHERE artist_id = ? ORDER BY recorded_at DESC').all(id);
  const streaming = db.prepare('SELECT * FROM streaming_updates WHERE artist_id = ? ORDER BY recorded_at DESC').all(id);
  const releases = db.prepare('SELECT * FROM releases WHERE artist_id = ? ORDER BY release_date DESC').all(id);
  const promotions = db.prepare('SELECT * FROM promotion_log WHERE artist_id = ? ORDER BY date DESC').all(id);
  const notes = db.prepare('SELECT * FROM notes WHERE artist_id = ? ORDER BY created_at DESC').all(id);

  const dataSnapshot = { artist, social, streaming, releases, promotions, notes };
  const prompt = buildAnalysisPrompt(dataSnapshot);

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: `You are a senior music industry analyst and artist development strategist with deep expertise in streaming, social media, A&R, and music marketing. You work for music management companies and record labels producing confidential strategic intelligence reports.

Be specific, data-driven, and direct. Reference actual numbers and trends from the provided data. Never give generic advice — every insight must be grounded in this specific artist's data. Format your analysis in clean markdown with clear section headers and bullet points for readability.`,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = message.content[0].text;
    const result = db.prepare(`
      INSERT INTO analyses (artist_id, content, model, data_snapshot)
      VALUES (?, ?, ?, ?)
    `).run(id, content, 'claude-sonnet-4-6', JSON.stringify(dataSnapshot));

    touchArtist(id);
    res.json(db.prepare('SELECT * FROM analyses WHERE id = ?').get(result.lastInsertRowid));
  } catch (error) {
    console.error('Claude API error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate analysis' });
  }
});

app.get('/api/artists/:id/analyses/:aid', (req, res) => {
  const analysis = db.prepare('SELECT * FROM analyses WHERE id = ? AND artist_id = ?')
    .get(req.params.aid, req.params.id);
  if (!analysis) return res.status(404).json({ error: 'Analysis not found' });
  res.json(analysis);
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function touchArtist(id) {
  db.prepare('UPDATE artists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
}

function buildAnalysisPrompt({ artist, social, streaming, releases, promotions, notes }) {
  let p = `# Artist Intelligence Analysis Request\n\nProduce a comprehensive strategic analysis for the following artist.\n\n`;

  p += `## Artist Profile\n`;
  p += `**Name:** ${artist.name}\n`;
  if (artist.genre) p += `**Genre:** ${artist.genre}${artist.subgenre ? ` / ${artist.subgenre}` : ''}\n`;
  if (artist.career_stage) p += `**Career Stage:** ${artist.career_stage}\n`;
  if (artist.country) p += `**Country:** ${artist.country}\n`;
  if (artist.primary_market) p += `**Primary Market:** ${artist.primary_market}\n`;
  if (artist.bio) p += `**Bio:** ${artist.bio}\n`;

  if (artist.artistic_goals || artist.visual_identity || artist.moodboard_references || artist.sound_references || artist.what_not_to_do) {
    p += `\n## Artistic Direction\n`;
    if (artist.artistic_goals) p += `**Goals:** ${artist.artistic_goals}\n`;
    if (artist.visual_identity) p += `**Visual Identity:** ${artist.visual_identity}\n`;
    if (artist.moodboard_references) p += `**Moodboard/References:** ${artist.moodboard_references}\n`;
    if (artist.sound_references) p += `**Sound References:** ${artist.sound_references}\n`;
    if (artist.what_not_to_do) p += `**What NOT to do:** ${artist.what_not_to_do}\n`;
  }

  if (social.length > 0) {
    p += `\n## Social Media Data (${social.length} snapshots, newest first)\n`;
    social.slice(0, 4).forEach((s, i) => {
      p += `\n**Snapshot ${i + 1}** — ${s.recorded_at}:\n`;
      if (s.instagram_followers) p += `- Instagram: ${Number(s.instagram_followers).toLocaleString()} followers, ${s.instagram_engagement}% engagement, trend: ${s.instagram_trend}\n`;
      if (s.tiktok_followers) p += `- TikTok: ${Number(s.tiktok_followers).toLocaleString()} followers, ${Number(s.tiktok_avg_views).toLocaleString()} avg views, trend: ${s.tiktok_trend}\n`;
      if (s.youtube_subscribers) p += `- YouTube: ${Number(s.youtube_subscribers).toLocaleString()} subscribers, ${Number(s.youtube_avg_views).toLocaleString()} avg views, trend: ${s.youtube_trend}\n`;
      if (s.other_platforms) p += `- Other: ${s.other_platforms}\n`;
      if (s.notes) p += `- Notes: ${s.notes}\n`;
    });
  }

  if (streaming.length > 0) {
    p += `\n## Streaming Data (${streaming.length} snapshots, newest first)\n`;
    streaming.slice(0, 4).forEach((s, i) => {
      p += `\n**Snapshot ${i + 1}** — ${s.recorded_at}:\n`;
      if (s.spotify_monthly_listeners) p += `- Spotify Monthly Listeners: ${Number(s.spotify_monthly_listeners).toLocaleString()}\n`;
      if (s.spotify_top_markets) p += `- Spotify Top Markets: ${s.spotify_top_markets}\n`;
      if (s.spotify_playlist_placements) p += `- Playlist Placements: ${s.spotify_playlist_placements}\n`;
      p += `- Apple Music: ${s.apple_music_presence ? 'Yes' : 'No'}\n`;
      if (s.apple_music_placements) p += `- Apple Music Placements: ${s.apple_music_placements}\n`;
      if (s.other_dsps) p += `- Other DSPs: ${s.other_dsps}\n`;
      if (s.notes) p += `- Notes: ${s.notes}\n`;
    });
  }

  if (releases.length > 0) {
    p += `\n## Release History\n`;
    releases.forEach(r => {
      p += `- **${r.title}** (${r.type || 'Unknown type'}, ${r.release_date || 'date TBD'})\n`;
      if (r.performance_notes) p += `  Performance: ${r.performance_notes}\n`;
      if (r.promotional_context) p += `  Promo context: ${r.promotional_context}\n`;
    });
  }

  if (promotions.length > 0) {
    p += `\n## Promotion Log\n`;
    promotions.forEach(pr => {
      p += `- **${pr.date || 'N/A'}** [${pr.type || 'general'}]: ${pr.description}\n`;
      if (pr.result) p += `  Result: ${pr.result}\n`;
    });
  }

  if (artist.competitors || artist.genre_trends || artist.opportunities) {
    p += `\n## Market Context\n`;
    if (artist.competitors) p += `**Reference Artists / Competitors:** ${artist.competitors}\n`;
    if (artist.genre_trends) p += `**Genre Trends:** ${artist.genre_trends}\n`;
    if (artist.opportunities) p += `**Identified Opportunities:** ${artist.opportunities}\n`;
  }

  if (notes.length > 0) {
    p += `\n## Internal Notes\n`;
    notes.slice(0, 6).forEach(n => {
      p += `- _(${n.created_at})_ ${n.content}\n`;
    });
  }

  p += `\n---\n\n## Required Analysis Output\n\nStructure your response with these exact sections:\n\n`;
  p += `### 1. Performance Summary\nCurrent state overview, key strengths to leverage, key weaknesses or gaps to address.\n\n`;
  p += `### 2. Growth Opportunities\nSpecific actionable opportunities grounded in the data. Markets or platforms showing positive signals. Timing recommendations.\n\n`;
  p += `### 3. Strategic Recommendations\n- **Next 30 days:** Priority actions\n- **Next 90 days:** Medium-term direction\n- **Risks to watch**\n\n`;
  p += `### 4. A&R / Development Notes\nArtistic development observations. Positioning refinement suggestions. Narrative and storytelling recommendations.\n\n`;
  p += `### 5. Promotion Intelligence\nWhat is working based on the promotion log. What should be tested next. Format and channel recommendations.\n`;

  return p;
}

app.listen(PORT, () => {
  console.log(`\n🎵 Artist Intelligence Hub server running on http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠️  ANTHROPIC_API_KEY not set — AI analysis will be unavailable');
    console.warn('   Create server/.env and add: ANTHROPIC_API_KEY=your_key_here\n');
  }
});
