import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../design/Icon.jsx'
import { LogoMark } from '../design/Logo.jsx'
import { getTools } from '../tools/index.js'
import { useOnlineStatus } from './useOnlineStatus.js'

function SearchBox() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return getTools().filter((t) => t.name.toLowerCase().includes(q) || t.summary.toLowerCase().includes(q))
  }, [query])

  const open = (tool) => {
    setQuery('')
    navigate(tool.path)
  }

  return (
    <div className="search" role="search">
      <Icon name="search" size={18} />
      <input
        type="search"
        aria-label="Search Gala"
        placeholder="Search tools"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setQuery('')
          if (e.key === 'Enter' && results[0]) open(results[0])
        }}
      />
      {query.trim() && (
        <ul className="search-results" aria-label="Search results">
          {results.length > 0 ? (
            results.map((tool) => (
              <li key={tool.id}>
                <Link to={tool.path} onClick={() => setQuery('')}>
                  <Icon name={tool.icon} size={18} />
                  <span>{tool.name}</span>
                </Link>
              </li>
            ))
          ) : (
            <li className="search-empty">No matches</li>
          )}
        </ul>
      )}
    </div>
  )
}

function ConnectionStatus() {
  const online = useOnlineStatus()
  return (
    <span className="status" data-online={online} role="status">
      <Icon name={online ? 'wifi' : 'wifi-off'} size={16} />
      <span className="status-text">{online ? 'Online' : 'Offline'}</span>
    </span>
  )
}

export function TopBar() {
  return (
    <header className="topbar">
      <Link to="/" className="topbar-brand" aria-label="Gala home">
        <LogoMark size={28} />
      </Link>
      <SearchBox />
      <div className="topbar-actions">
        <ConnectionStatus />
        <Link to="/profile" className="avatar" aria-label="Profile">
          <Icon name="user" size={18} />
        </Link>
      </div>
    </header>
  )
}
