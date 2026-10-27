import { Link, NavLink } from 'react-router-dom'
import { Icon } from '../design/Icon.jsx'
import { LogoMark } from '../design/Logo.jsx'
import { getTools } from '../tools/index.js'
import { MAIN_NAV } from './nav.js'

function SideLink({ item }) {
  return (
    <NavLink to={item.path} end={item.end} className="side-link">
      <Icon name={item.icon} size={20} />
      <span>{item.name}</span>
    </NavLink>
  )
}

export function Sidebar() {
  return (
    <aside className="sidebar">
      <Link to="/" className="brand" aria-label="Gala home">
        <LogoMark size={30} />
        <span className="brand-name">Gala</span>
      </Link>
      <nav aria-label="Primary" className="side-nav">
        <ul>
          {MAIN_NAV.map((item) => (
            <li key={item.id}>
              <SideLink item={item} />
            </li>
          ))}
        </ul>
        <p className="side-label">Studio</p>
        <ul>
          {getTools().map((tool) => (
            <li key={tool.id}>
              <SideLink item={tool} />
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
