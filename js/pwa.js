// Bộ công cụ: cài như ứng dụng (PWA) và chạy khi mất mạng — đăng ký sw.js ở gốc bộ công cụ.
// Dùng chung cho mọi trang:  <script src="…/js/pwa.js" defer></script>
//   - ToolsetPWA.canInstall() / install(): nút "Cài ứng dụng" (Chrome / Edge / Android)
//   - ToolsetPWA.isIOS() / isStandalone(): gợi ý "Thêm vào MH chính" trên iPhone
//   - <html class="is-offline"> và sự kiện 'toolset:network' khi mất / có mạng lại
window.ToolsetPWA = (() => {
  const script = document.currentScript;
  const root = script && script.src ? new URL('../', script.src).href : new URL('./', location.href).href;

  if ('serviceWorker' in navigator && window.isSecureContext) {
    const register = () => navigator.serviceWorker.register(root + 'sw.js', { scope: root }).catch(() => { /* bỏ qua */ });
    if (document.readyState === 'complete') register(); else window.addEventListener('load', register);
  }

  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    // chỉ thay bằng nút của mình ở trang có nút cài (trang chủ); trang khác để trình duyệt tự gợi ý
    if (!document.querySelector('[data-pwa-install]')) return;
    e.preventDefault();
    deferredPrompt = e;
    document.dispatchEvent(new CustomEvent('toolset:installable'));
  });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; document.dispatchEvent(new CustomEvent('toolset:installed')); });

  const syncNetwork = () => {
    document.documentElement.classList.toggle('is-offline', navigator.onLine === false);
    document.dispatchEvent(new CustomEvent('toolset:network', { detail: { online: navigator.onLine !== false } }));
  };
  window.addEventListener('online', syncNetwork);
  window.addEventListener('offline', syncNetwork);
  syncNetwork();

  return {
    canInstall: () => !!deferredPrompt,
    async install() {
      if (!deferredPrompt) return false;
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice.catch(() => null);
      deferredPrompt = null;
      return !!choice && choice.outcome === 'accepted';
    },
    isStandalone: () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true,
    isIOS: () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  };
})();
