import { NavLink } from 'react-router-dom'
import { Icon } from '../design/Icon.jsx'
import { getMobileNav } from './nav.js'

export function BottomNav() {
  return (
    <nav className="bottomnav" aria-label="Mobile">
      <ul>
        {getMobileNav().map((item) => (
          <li key={item.id}>
            <NavLink to={item.path} end={item.end} className="bottom-link">
              <Icon name={item.icon} size={22} />
              <span>{item.name}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
