import { useEffect, useState } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { api } from '../api'

export default function Layout() {
  const [apiKeyOk, setApiKeyOk] = useState(true)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    api.health().then(h => setApiKeyOk(h.apiKeyConfigured)).catch(() => {})
  }, [])

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-gray-950 border-r border-gray-800 flex flex-col">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-800">
          <Link to="/" className="block">
            <div className="text-xs font-semibold tracking-widest text-indigo-400 uppercase mb-0.5">Artist</div>
            <div className="text-xl font-bold text-white leading-tight">Intelligence Hub</div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <NavItem to="/" label="All Artists" icon={<UsersIcon />} active={location.pathname === '/'} />
        </nav>

        {/* Add artist button */}
        <div className="px-3 py-4 border-t border-gray-800">
          <button
            onClick={() => navigate('/artists/new')}
            className="w-full btn-primary flex items-center justify-center gap-2 text-sm"
          >
            <span className="text-lg leading-none">+</span>
            New Artist
          </button>
        </div>

        {/* API key warning */}
        {!apiKeyOk && (
          <div className="px-3 pb-4">
            <div className="bg-amber-900/40 border border-amber-700/50 rounded-lg px-3 py-2.5 text-xs text-amber-300">
              <div className="font-semibold mb-1">API Key Missing</div>
              <div className="text-amber-400/80">Add <code className="bg-amber-900/50 px-1 rounded">ANTHROPIC_API_KEY</code> to <code className="bg-amber-900/50 px-1 rounded">server/.env</code></div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-800">
          <div className="text-xs text-gray-600">v1.0 · Local Instance</div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-gray-950">
        <Outlet />
      </main>
    </div>
  )
}

function NavItem({ to, label, icon, active }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
        active
          ? 'bg-indigo-600/20 text-indigo-300 font-medium'
          : 'text-gray-400 hover:text-white hover:bg-gray-800'
      }`}
    >
      <span className="w-4 h-4 shrink-0">{icon}</span>
      {label}
    </Link>
  )
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}
