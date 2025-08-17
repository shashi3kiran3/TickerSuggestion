import { NavLink, Outlet } from 'react-router-dom'
import { useState } from 'react'
import { Home, Lightbulb, Newspaper, Calendar, LineChart, Bot, Settings, Menu, Search } from 'lucide-react'

type Item = { to: string; label: string; id: string; Icon: React.ComponentType<{ className?: string }> }
const items: Item[] = [
  { to: '/', label: 'Dashboard', id: 'nav-dashboard', Icon: Home },
  { to: '/suggestions', label: 'Suggestions', id: 'nav-suggestions', Icon: Lightbulb },
  { to: '/news', label: 'News', id: 'nav-news', Icon: Newspaper },
  { to: '/events', label: 'Events', id: 'nav-events', Icon: Calendar },
  { to: '/predictions', label: 'Predictions', id: 'nav-predictions', Icon: LineChart },
  { to: '/ask-ai', label: 'Ask AI', id: 'nav-ask-ai', Icon: Bot },
  { to: '/settings', label: 'Settings', id: 'nav-settings', Icon: Settings },
]

export default function RootLayout() {
  const [open, setOpen] = useState(false)

  return (
    <div id="app-root" className="min-h-screen bg-gray-50">
      {/* Top header: logo (left) + Admin (right) */}
      <header id="top-header" className="sticky top-0 z-40 border-b bg-white shadow-sm">
        <div id="header-inner" className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div id="header-left" className="flex items-center gap-3">
            <button
              id="btn-menu-toggle"
              aria-label="Open menu"
              onClick={() => setOpen(true)}
              className="md:hidden rounded-md border px-2 py-1 text-gray-700"
            >
              <Menu className="h-4 w-4" />
            </button>
            <img id="brand-logo" src="/logo.png" alt="MarketPulse" className="h-8 w-8" />
            <span id="brand-name" className="font-semibold text-gray-800">MarketPulse</span>
          </div>
          <div id="header-right" className="flex items-center gap-3">
            <div id="search-box" className="hidden sm:flex items-center gap-2 rounded-full border px-3 py-2 text-sm text-gray-600 shadow-sm bg-white">
              <Search className="h-4 w-4" />
              <input
                id="search-input"
                type="text"
                placeholder="Search tickers, news..."
                className="w-40 focus:outline-none placeholder:text-gray-400"
              />
            </div>
            <NavLink
              id="btn-login"
              to="/admin"
              className="rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white hover:from-blue-500 hover:to-indigo-500 shadow"
            >
              Login
            </NavLink>
          </div>
        </div>
      </header>

      <div id="body-container" className="min-h-[calc(100vh-4rem)] md:flex">
        {/* Left navigation (md and up) */}
        <aside id="left-sidebar" className="hidden md:flex md:fixed md:inset-y-0 md:left-0 md:z-40 md:w-72 md:flex-col md:border-r md:border-gray-800 md:bg-[#111827] md:text-gray-200">
          <nav id="sidebar-nav" className="px-3 py-4">
            <ul id="sidebar-list" className="space-y-2">
              {items.map((it) => (
                <li key={it.to}>
                  <NavLink
                    id={it.id}
                    to={it.to}
                    end={it.to === '/'}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition whitespace-nowrap ${
                        isActive
                          ? 'bg-gray-800 text-white shadow-sm'
                          : 'text-gray-300 hover:bg-gray-700/60 hover:text-white'
                      }`
                    }
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-gray-700/80 text-gray-100">
                      <it.Icon className="h-4 w-4" />
                    </span>
                    <span>{it.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Mobile top menu (shown when open) */}
        {open && (
          <div id="mobile-menu" className="md:hidden w-full border-b bg-[#111827] text-gray-100">
            <div id="mobile-menu-scroll" className="flex overflow-x-auto gap-2 px-3 py-2">
              {items.map((it) => (
                <NavLink
                  id={`${it.id}-mobile`}
                  key={it.to}
                  to={it.to}
                  end={it.to === '/'}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-full px-3 py-1.5 text-sm whitespace-nowrap ${
                      isActive ? 'bg-gray-800 text-white' : 'text-gray-300 bg-gray-700/40'
                    }`
                  }
                >
                  <it.Icon className="h-4 w-4" />
                  {it.label}
                </NavLink>
              ))}
            </div>
          </div>
        )}

        {/* Right content area */}
        <main
          id="main-content"
          className="relative bg-gradient-to-br from-blue-950 to-slate-900 text-gray-100 px-4 py-6 sm:px-6 lg:px-8 md:ml-72 md:flex-1"
        >
          <img
            id="main-bg"
            src="/bg-right.jpg"
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-10"
            loading="eager"
            aria-hidden
            onError={(e) => {
              // Hide the image element if the asset is missing; gradient fallback remains
              e.currentTarget.style.display = 'none'
            }}
          />
          <div id="main-overlay" className="pointer-events-none absolute inset-0 bg-blue-950/80" />
          <div id="main-inner" className="relative z-10">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}


