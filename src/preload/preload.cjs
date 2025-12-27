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

  // Right-click on messages to open the message menu (Reply, React, etc.)
  document.addEventListener('contextmenu', (event) => {
    // Find if we clicked on or inside a message bubble
    // Messages have data-id attribute with format like "true_xxx" or "false_xxx"
    const messageElement = event.target.closest('[data-id]');
    if (!messageElement) return;

    // Verify this is a message by checking the data-id format
    const dataId = messageElement.getAttribute('data-id');
    if (!dataId || (!dataId.startsWith('true_') && !dataId.startsWith('false_'))) return;

    // Prevent the default context menu
    event.preventDefault();
    event.stopPropagation();

    // Find the dropdown arrow button - it has data-js-context-icon="true"
    // and contains an icon with data-icon="ic-chevron-down-menu"
    let dropdownButton = messageElement.querySelector('[data-js-context-icon="true"]');

    // If not found directly in the message, look in parent row
    if (!dropdownButton) {
      const row = messageElement.closest('[role="row"]');
      if (row) {
        dropdownButton = row.querySelector('[data-js-context-icon="true"]');
      }
    }

    // Also try finding by the icon inside
    if (!dropdownButton) {
      const icon = messageElement.querySelector('[data-icon="ic-chevron-down-menu"]');
      if (icon) {
        dropdownButton = icon.closest('[role="button"]');
      }
    }

    if (dropdownButton) {
      // The button might be hidden until hover, so we need to trigger hover first
      // Find the message container that shows the button on hover
      const messageContainer = messageElement.closest('.message-in, .message-out') ||
                               messageElement.closest('[class*="message"]') ||
                               messageElement;

      // Dispatch mouseenter to trigger hover state
      const mouseEnterEvent = new MouseEvent('mouseenter', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      messageContainer.dispatchEvent(mouseEnterEvent);

      // Also dispatch mouseover
      const mouseOverEvent = new MouseEvent('mouseover', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: event.clientX,
        clientY: event.clientY
      });
      messageContainer.dispatchEvent(mouseOverEvent);

      // Small delay to allow the button to become visible, then click
      setTimeout(() => {
        dropdownButton.click();
      }, 100);
    }
  }, true);
});
