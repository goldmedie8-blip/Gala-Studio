import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './design/tokens.css'
import './design/base.css'
import './design/components.css'
import './app/shell.css'
import App from './app/App.jsx'
import { startInstallWatch } from './app/install.js'

// Caches the whole app so it opens with no connection, and updates itself when a new version ships.
registerSW({ immediate: true })
// Listens for the browser's install offer from the very start, before the screen has loaded.
startInstallWatch()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
