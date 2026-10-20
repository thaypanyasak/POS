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
    this.lastCheckedTime = null;
  }

  /**
   * Gọi ngay khi React App vừa mount thành công để xác nhận bản update không bị crash
   */
  async notifyAppReady() {
    if (!this.isNative) return;
    try {
      await CapacitorUpdater.notifyAppReady();
      console.log('[LiveUpdate] Native App ready notification sent.');
    } catch (e) {
      console.warn('[LiveUpdate] notifyAppReady warning:', e);
    }
  }

  /**
   * Lấy thông tin phiên bản OTA hiện tại, channel và bundle đang chờ áp dụng
   */
  async getCurrentVersion() {
    if (!this.isNative) {
      return {
        version: 'Web Browser (Dev/Preview)',
        status: 'active',
        isNative: false,
        channel: 'web',
        pendingVersion: null,
      };
    }
    try {
      const current = await CapacitorUpdater.current();
      let channelName = 'production';
      try {
        const chan = await CapacitorUpdater.getChannel();
        if (chan?.channel) channelName = chan.channel;
      } catch (_) {}

      // Kiểm tra xem có bundle mới nào đã tải xong đang chờ áp dụng không
      let pendingBundle = null;
      try {
        const next = await CapacitorUpdater.getNextBundle();
        if (next && next.version && next.version !== current?.bundle?.version) {
          pendingBundle = next;
        }
      } catch (_) {}

      return {
        version: current?.bundle?.version || current?.native || '1.0.0',
        bundleId: current?.bundle?.id || 'builtin',
        status: current?.bundle?.status || 'active',
        channel: channelName,
        nativeVersion: current?.native || '1.0.0',
        pendingVersion: pendingBundle ? pendingBundle.version : null,
        pendingBundle,
        isNative: true,
      };
    } catch (e) {
      console.error('[LiveUpdate] getCurrentVersion error:', e);
      return { version: '1.0.0', isNative: true, channel: 'production', pendingVersion: null };
    }
  }

  /**
   * Tự động kiểm tra bản cập nhật mới trên Capgo Cloud
   * - Nếu đã có bundle tải sẵn trong bộ nhớ: trả về ngay để kích hoạt
   * - Nếu có bản mới trên Cloud: tải về và chuẩn bị
   */
  async checkForUpdates({ directZipUrl = null, newVersion = null, onProgress = null } = {}) {
    if (!this.isNative) {
      return { hasUpdate: false, message: 'Đang chạy trên nền Web.' };
    }
    if (this.isChecking) {
      return { hasUpdate: false, message: 'ກຳລັງກວດສອບອັບເດດຢູ່ແລ້ວ...' };
    }

    this.isChecking = true;
    this.lastCheckedTime = new Date();

    try {
      console.log('[LiveUpdate] Checking for updates on Capgo Cloud...');

      // 1. Kiểm tra xem có bundle nào đã tải sẵn chưa kích hoạt không
      const current = await CapacitorUpdater.current();
      const currentVersion = current?.bundle?.version || '0.0.0';

      const nextBundle = await CapacitorUpdater.getNextBundle().catch(() => null);
      if (nextBundle && nextBundle.version && nextBundle.version !== currentVersion) {
        console.log('[LiveUpdate] Found pending downloaded bundle:', nextBundle);
        return {
          hasUpdate: true,
          bundle: nextBundle,
          version: nextBundle.version,
          alreadyDownloaded: true,
          message: `ພົບເວີຊັນໃໝ່ ${nextBundle.version} ພ້ອມນຳໃຊ້ທັນທີ!`,
        };
      }

      // 2. Tải trực tiếp từ URL zip tùy chọn nếu có
      if (directZipUrl && newVersion) {
        if (onProgress) onProgress({ status: 'downloading', percent: 15 });
        const res = await CapacitorUpdater.download({
          url: directZipUrl,
          version: newVersion,
        });
        if (onProgress) onProgress({ status: 'ready', percent: 100 });
        console.log('[LiveUpdate] Custom zip downloaded:', res);
        return {
          hasUpdate: true,
          bundle: res,
          version: newVersion,
          alreadyDownloaded: false,
          message: `ດາວໂຫຼດເວີຊັນໃໝ່ ${newVersion} ສຳເລັດແລ້ວ!`,
        };
      }

      // 3. Kiểm tra tự động qua Capgo Cloud Channel
      const latestBundle = await CapacitorUpdater.getLatest();
      console.log('[LiveUpdate] Remote latest bundle info:', latestBundle);

      if (latestBundle && latestBundle.version && latestBundle.version !== currentVersion) {
        if (!latestBundle.url) {
          console.warn('[LiveUpdate] Latest bundle has no download URL.');
          return {
            hasUpdate: false,
            version: currentVersion,
            message: 'ແອັບຂອງທ່ານເປັນເວີຊັນລ້າສຸດແລ້ວ.',
          };
        }

        if (onProgress) onProgress({ status: 'downloading', percent: 25 });
        const res = await CapacitorUpdater.download({
          url: latestBundle.url,
          version: latestBundle.version,
        });
        if (onProgress) onProgress({ status: 'ready', percent: 100 });

        console.log('[LiveUpdate] New bundle downloaded successfully:', res);
        return {
          hasUpdate: true,
          bundle: res,
          version: latestBundle.version,
          alreadyDownloaded: false,
          message: `ດາວໂຫຼດເວີຊັນໃໝ່ ${latestBundle.version} ສຳເລັດແລ້ວ!`,
        };
      }

      return {
        hasUpdate: false,
        version: currentVersion,
        message: 'ແອັບຂອງທ່ານເປັນເວີຊັນລ້າສຸດແລ້ວ (Up to date).',
      };
    } catch (err) {
      console.error('[LiveUpdate] Update check error:', err);
      throw err;
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Kích hoạt bản cập nhật và tự động reload app NGAY LẬP TỨC
   * Người dùng KHÔNG CẦN phải out app hay clear app trong multitasking!
   */
  async applyUpdateAndReload(bundleInfo) {
    if (!this.isNative) {
      window.location.reload();
      return;
    }
    try {
      const bundleId = bundleInfo?.id || (typeof bundleInfo === 'string' ? bundleInfo : null);
      if (bundleId) {
        console.log(`[LiveUpdate] Setting active bundle id: ${bundleId}`);
        await CapacitorUpdater.set({ id: bundleId });
      }

      console.log('[LiveUpdate] Calling CapacitorUpdater.reload() to refresh app immediately...');
      await CapacitorUpdater.reload();
    } catch (e) {
      console.warn('[LiveUpdate] Native reload failed, falling back to window.location.reload():', e);
      window.location.reload();
    }
  }

  /**
   * Tự động reload ứng dụng trực tiếp
   */
  async reloadApp() {
    if (!this.isNative) {
      window.location.reload();
      return;
    }
    try {
      await CapacitorUpdater.reload();
    } catch (_) {
      window.location.reload();
    }
  }

  /**
   * Hoàn tác về bản cài IPA gốc nếu phát hiện lỗi
   */
  async rollbackToDefault() {
    if (!this.isNative) return;
    try {
      await CapacitorUpdater.reset();
      console.log('[LiveUpdate] Reset back to built-in IPA bundle.');
      await this.reloadApp();
    } catch (e) {
      console.error('[LiveUpdate] Reset error:', e);
    }
  }
}

export const liveUpdater = new LiveUpdateManager();
export default liveUpdater;
