import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { liveUpdater } from './services/liveUpdateService'

// Thông báo cho Capgo OTA biết app đã khởi chạy thành công
liveUpdater.notifyAppReady();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

