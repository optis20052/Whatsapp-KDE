const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendNotification: (data) => ipcRenderer.send('show-notification', data),
  updateBadge: (count) => ipcRenderer.send('update-badge', count),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  onNotificationClick: (callback) => ipcRenderer.on('notification-clicked', callback)
});

window.addEventListener('DOMContentLoaded', () => {
  class ElectronNotification {
    constructor(title, options = {}) {
      this.title = title;
      this.body = options.body || '';
      this.icon = options.icon || '';
      this.tag = options.tag || '';

      ipcRenderer.send('show-notification', {
        title,
        body: this.body,
        icon: this.icon,
        tag: this.tag
      });

      this.onclick = null;
      this.onerror = null;
      this.onclose = null;
      this.onshow = null;
    }

    close() {}

    static requestPermission() {
      return Promise.resolve('granted');
    }

    static get permission() {
      return 'granted';
    }

    static get maxActions() {
      return 0;
    }
  }

  window.Notification = ElectronNotification;

  let lastCount = 0;

  function updateBadgeCount() {
    const match = document.title.match(/\((\d+)\)/);
    const count = match ? parseInt(match[1]) : 0;

    if (count !== lastCount) {
      lastCount = count;
      ipcRenderer.send('update-badge', count);
    }
  }

  const titleElement = document.querySelector('title');
  if (titleElement) {
    new MutationObserver(updateBadgeCount).observe(titleElement, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  setInterval(updateBadgeCount, 2000);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) updateBadgeCount();
  });

  setTimeout(updateBadgeCount, 3000);
});
