import { Suspense, lazy, useMemo } from 'react'
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

// Renders a registered tool. When a tool ships a real panel (component: () => import('./Panel.jsx')),
// it loads on demand. Until then the page shows what is coming.
export default function ToolPage({ tool }) {
  const Panel = useMemo(() => (tool.component ? lazy(tool.component) : null), [tool])

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
