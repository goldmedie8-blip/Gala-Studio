import { Icon } from './Icon.jsx'

export function EmptyState({ icon, title, children }) {
  return (
    <div className="empty">
      <span className="tile tile-lg">
        <Icon name={icon} size={26} />
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  )
}
