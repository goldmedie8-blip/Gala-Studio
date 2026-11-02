import { Icon } from '../design/Icon.jsx'
import { useInstall } from './install.js'

// A small Install button in the top bar, only while the browser is ready to install Gala.
export function InstallButton() {
  const { canInstall, installed, install } = useInstall()
  if (installed || !canInstall) return null
  return (
    <button type="button" className="btn btn-secondary install-btn" onClick={install}>
      <Icon name="download" size={18} />
      <span className="install-text">Install</span>
    </button>
  )
}
