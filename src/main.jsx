import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initAnalytics } from './services/analytics.js'
import { initOfflineQueue } from './services/offlineQueue.js'
import { initTerminalMonitoring } from './services/terminalMonitoring.js'

initAnalytics()
initOfflineQueue()
initTerminalMonitoring()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
