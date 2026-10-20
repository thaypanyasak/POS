import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

/**
 * Service quản lý Live Update OTA (Cập nhật không cần cài lại IPA)
 * Code bundle được lưu và chạy trực tiếp từ bộ nhớ iPad, đảm bảo tốc độ Native 100%.
 */

class LiveUpdateManager {
  constructor() {
    this.isNative = Capacitor.isNativePlatform();
    this.isChecking = false;
  }

  /**
   * Gọi ngay khi React App vừa mount thành công để xác nhận bản update không bị crash
   */
  async notifyAppReady() {
    if (!this.isNative) return;
    try {
      await CapacitorUpdater.notifyAppReady();
      console.log('✅ [LiveUpdate] Native App ready notification sent.');
    } catch (e) {
      console.warn('⚠️ [LiveUpdate] notifyAppReady warning:', e);
    }
  }

  /**
   * Lấy thông tin phiên bản OTA hiện tại
   */
  async getCurrentVersion() {
    if (!this.isNative) {
      return { version: 'Web (Vite dev/prod)', isNative: false };
    }
    try {
      const current = await CapacitorUpdater.current();
      return {
        version: current?.bundle?.version || 'Gốc (.ipa)',
        status: current?.bundle?.status || 'active',
        isNative: true,
      };
    } catch (e) {
      console.error('⚠️ [LiveUpdate] getCurrentVersion error:', e);
      return { version: 'Chưa rõ', isNative: true };
    }
  }

  /**
   * Tự động kiểm tra bản cập nhật mới
   * Hỗ trợ cập nhật qua Capgo Cloud hoặc URL bundle zip tùy chọn
   */
  async checkForUpdates({ directZipUrl = null, newVersion = null, onProgress = null } = {}) {
    if (!this.isNative || this.isChecking) return null;
    this.isChecking = true;

    try {
      console.log('🔍 [LiveUpdate] Checking for remote bundle updates...');

      // Trường hợp 1: Tải trực tiếp từ URL zip (ví dụ từ Supabase Storage hoặc Server riêng)
      if (directZipUrl && newVersion) {
        if (onProgress) onProgress({ status: 'downloading', percent: 10 });
        const res = await CapacitorUpdater.download({
          url: directZipUrl,
          version: newVersion,
        });
        if (onProgress) onProgress({ status: 'ready', percent: 100 });
        console.log('📦 [LiveUpdate] Bundle downloaded:', res);
        return res;
      }

      // Trường hợp 2: Kiểm tra tự động qua channel Capgo mặc định
      // Gọi getLatest() để lấy bundle mới nhất từ Capgo Cloud và tải về
      const latestBundle = await CapacitorUpdater.getLatest();
      console.log('📦 [LiveUpdate] Remote latest bundle info:', latestBundle);
      if (latestBundle && latestBundle.url) {
        if (onProgress) onProgress({ status: 'downloading', percent: 20 });
        const res = await CapacitorUpdater.download({
          url: latestBundle.url,
          version: latestBundle.version,
        });
        if (onProgress) onProgress({ status: 'ready', percent: 100 });
        return res;
      }
      return null;
    } catch (err) {
      console.error('❌ [LiveUpdate] Update check error:', err);
      return null;
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Kích hoạt bản cập nhật đã tải về
   */
  async applyUpdate(bundleInfo) {
    if (!this.isNative || !bundleInfo) return;
    try {
      await CapacitorUpdater.set(bundleInfo);
      console.log('🚀 [LiveUpdate] Reloading app into new bundle...');
      // CapacitorUpdater.set() tự động reload WebView với code mới
    } catch (e) {
      console.error('❌ [LiveUpdate] Apply update error:', e);
    }
  }

  /**
   * Hoàn tác về bản cài IPA gốc nếu phát hiện lỗi
   */
  async rollbackToDefault() {
    if (!this.isNative) return;
    try {
      await CapacitorUpdater.reset();
      console.log('🔄 [LiveUpdate] Reset back to built-in IPA bundle.');
    } catch (e) {
      console.error('❌ [LiveUpdate] Reset error:', e);
    }
  }
}

export const liveUpdater = new LiveUpdateManager();
export default liveUpdater;
