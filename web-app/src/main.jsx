import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { liveUpdater } from './services/liveUpdateService'
import { ensurePhetsarathLoaded } from './utils/phetsarathFont'
import { isCustomerStorefrontRoute } from './utils/routeUtils'

// Thông báo cho Capgo OTA biết app đã khởi chạy thành công
liveUpdater.notifyAppReady();

// Chỉ nạp font in nhiệt khi ở chế độ POS/Admin (không gọi ở trang khách xem menu)
if (!isCustomerStorefrontRoute()) {
  ensurePhetsarathLoaded().catch(() => {});
}

import { AuthProvider } from './contexts/AuthContext'
import ErrorBoundary from './components/common/ErrorBoundary'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)

