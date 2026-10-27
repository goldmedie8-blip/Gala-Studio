import { Link } from 'react-router-dom'
import { STAGES, stageStatus } from '../app/stages.js'
import { Icon } from '../design/Icon.jsx'
import { getTools } from '../tools/index.js'

const WAVE = [22, 38, 56, 30, 74, 96, 60, 84, 40, 66, 100, 52, 78, 34, 62, 90, 46, 70, 28, 54]

const STATUS_LABEL = { done: 'Done', next: 'Up next', planned: 'Planned' }
const STATUS_CLASS = { done: 'chip chip-ok', next: 'chip chip-accent', planned: 'chip' }

export default function Home() {
  const tools = getTools()

  return (
    <div className="page">
      <section className="hero" aria-labelledby="welcome">
        <div className="hero-copy">
          <p className="eyebrow">Gala Studio</p>
          <h1 id="welcome">Welcome to Gala</h1>
          <p className="lead">
            Record, write and produce your first song. Everything works without internet, so your studio goes
            wherever you go.
          </p>
          <div className="row">
            <Link className="btn btn-primary" to="/studio">
              <Icon name="layers" size={18} />
              Open studio
            </Link>
            <Link className="btn btn-secondary" to="/library">
              <Icon name="library" size={18} />
              Your library
            </Link>
          </div>
        </div>
        <div className="wave" aria-hidden="true">
          {WAVE.map((h, i) => (
            <span key={i} style={{ height: `${h}%` }} />
          ))}
        </div>
      </section>

      <section aria-labelledby="tools-heading">
        <h2 id="tools-heading" className="section-title">
          Studio tools
        </h2>
        <div className="grid">
          {tools.map((tool) => (
            <Link key={tool.id} to={tool.path} className="tool-card">
              <span className="tile">
                <Icon name={tool.icon} size={22} />
              </span>
              <span className="tool-card-body">
                <strong>{tool.name}</strong>
                <span>{tool.summary}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="progress-heading">
        <h2 id="progress-heading" className="section-title">
          Build progress
        </h2>
        <ol className="stage-list">
          {STAGES.map((s) => {
            const status = stageStatus(s)
            return (
              <li key={s.stage} className="stage-item" data-status={status}>
                <span className="stage-num">{s.stage}</span>
                <div className="stage-body">
                  <strong>{s.name}</strong>
                  <span>{s.summary}</span>
                </div>
                <span className={STATUS_CLASS[status]}>{STATUS_LABEL[status]}</span>
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}
