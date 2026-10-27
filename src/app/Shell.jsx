import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav.jsx'
import { PlayerBar } from './PlayerBar.jsx'
import { Sidebar } from './Sidebar.jsx'
import { TopBar } from './TopBar.jsx'

// Desktop and phone share one markup. CSS decides what shows:
// sidebar on wide screens, bottom bar on narrow ones.
export function Shell() {
  return (
    <div className="app">
      <Sidebar />
      <TopBar />
      <main className="main" id="main">
        <Outlet />
      </main>
      <PlayerBar />
      <BottomNav />
    </div>
  )
}
