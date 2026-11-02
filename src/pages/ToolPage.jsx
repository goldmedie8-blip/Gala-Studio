import { Suspense, lazy } from 'react'
import { Icon } from '../design/Icon.jsx'

function ComingSoon({ tool }) {
  return (
    <div className="card">
      <span className="chip chip-accent">Arrives in Stage {tool.stage}</span>
      <h2 style={{ marginTop: 'var(--s3)' }}>What this will do</h2>
      <ul className="feature-list">
        {tool.features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
    </div>
  )
}

// Each tool's screen is made once and remembered. Making it again on every draw would restart its loading
// every time, and moving from one tool to another (for example Piano to Timeline) would never finish.
const panels = new Map()
function panelFor(tool) {
  if (!tool.component) return null
  if (!panels.has(tool.id)) panels.set(tool.id, lazy(tool.component))
  return panels.get(tool.id)
}

// Renders a registered tool. When a tool ships a real panel (component: () => import('./Panel.jsx')),
// it loads on demand. Until then the page shows what is coming.
export default function ToolPage({ tool }) {
  const Panel = panelFor(tool)

  return (
    <div className="page">
      <header className="page-header">
        <span className="tile tile-lg">
          <Icon name={tool.icon} size={26} />
        </span>
        <div>
          <h1>{tool.name}</h1>
          <p className="muted">{tool.summary}</p>
        </div>
      </header>
      {Panel ? (
        <Suspense fallback={<p className="muted">Loading...</p>}>
          <Panel />
        </Suspense>
      ) : (
        <ComingSoon tool={tool} />
      )}
    </div>
  )
}
