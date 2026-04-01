# Artist Intelligence Hub

An AI-powered internal tool for music artist management companies and record labels. Track, analyse, and develop artists over time using Claude AI.

## Quick Start

### 1. Install dependencies
```bash
npm run install:all
```

### 2. Configure your API key
```bash
cp .env.example server/.env
# Edit server/.env and add your Anthropic API key:
# ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Run the app
```bash
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## Features

- **Artist Profiles** — Identity, artistic direction, market context
- **Social Media Tracking** — Timestamped snapshots of Instagram, TikTok, YouTube metrics
- **Streaming Data** — Spotify listener counts, markets, playlist placements, Apple Music
- **Release History** — Log all singles, EPs, albums with performance notes
- **Promotion Log** — Track press, playlist pitches, syncs, campaigns and outcomes
- **Notes** — Free-text observations included in AI analysis context
- **AI Analysis** — Claude generates a full strategic report: performance summary, growth opportunities, 30/90-day recommendations, A&R notes, promotion intelligence
- **Analysis History** — All past analyses stored and reviewable

## Tech Stack

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Node.js + Express
- **Database:** SQLite (via better-sqlite3) — all data stored in `server/data/artists.db`
- **AI:** Anthropic Claude API (`claude-sonnet-4-6`)

## Project Structure

```
├── server/
│   ├── index.js        # Express API + SQLite + Claude integration
│   └── data/           # SQLite database (auto-created)
├── client/
│   └── src/
│       ├── pages/
│       │   ├── ArtistList.jsx
│       │   ├── ArtistForm.jsx
│       │   ├── ArtistDashboard.jsx
│       │   └── tabs/   # Overview, Social, Streaming, Releases, Promotions, Notes, Analysis
│       ├── components/
│       │   └── Layout.jsx
│       └── api.js      # Typed API client
└── package.json        # Root scripts (dev, install:all)
```
