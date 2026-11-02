import { Icon } from '../design/Icon.jsx'
import { useInstall } from './install.js'

// The "put Gala on your device" card on Home. One tap where the browser allows it, and clear steps
// where it does not (iPhone and iPad, or a browser that has no install button).
export function InstallCard() {
  const { canInstall, installed, ios, dismissed, install, dismiss } = useInstall()
  if (installed || dismissed) return null

  return (
    <section className="card install-card" aria-labelledby="install-heading">
      <span className="tile">
        <Icon name="download" size={22} />
      </span>
      <div className="install-body">
        <h2 id="install-heading">Put Gala on your device</h2>
        {canInstall ? (
          <p>Install Gala to open it like any other app, full screen, and use it with no internet.</p>
        ) : ios ? (
          <p>
            On iPhone and iPad: tap the Share button in Safari, then choose <strong>Add to Home Screen</strong>, then{' '}
            <strong>Add</strong>.
          </p>
        ) : (
          <p>
            Open your browser menu and choose <strong>Install Gala</strong> or <strong>Add to Home screen</strong>. On
            Chrome and Edge for computers, look for the install icon at the right end of the address bar.
          </p>
        )}
        <div className="row">
          {canInstall && (
            <button type="button" className="btn btn-primary" onClick={install}>
              <Icon name="download" size={18} />
              Install Gala
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={dismiss}>
            Not now
          </button>
        </div>
      </div>
    </section>
  )
}
