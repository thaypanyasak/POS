import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { liveUpdater } from './services/liveUpdateService'
import { fetchPrinterConfigFromDb } from './services/printerConfigService'
import { ensurePhetsarathLoaded } from './utils/phetsarathFont'

// Thông báo cho Capgo OTA biết app đã khởi chạy thành công
liveUpdater.notifyAppReady();

// Tự động đồng bộ IP máy in dùng chung từ Supabase khi mở ứng dụng
fetchPrinterConfigFromDb().catch(() => {});

// Khởi tạo nạp font Phetsarath OT sẵn sàng cho in nhiệt
ensurePhetsarathLoaded().catch(() => {});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

