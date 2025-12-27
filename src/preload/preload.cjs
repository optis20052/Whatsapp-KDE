const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendNotification: (data) => ipcRenderer.send('show-notification', data),
  updateBadge: (count) => ipcRenderer.send('update-badge', count),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  onNotificationClick: (callback) => ipcRenderer.on('notification-clicked', callback)
});

window.addEventListener('DOMContentLoaded', () => {
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

  // Right-click on messages to open the message menu
  document.addEventListener('contextmenu', (event) => {
    const messageElement = event.target.closest('[data-id]');
    if (!messageElement) return;

    const dataId = messageElement.getAttribute('data-id');
    if (!dataId || (!dataId.startsWith('true_') && !dataId.startsWith('false_'))) return;

    event.preventDefault();
    event.stopPropagation();

    let dropdownButton = messageElement.querySelector('[data-js-context-icon="true"]');

    if (!dropdownButton) {
      const row = messageElement.closest('[role="row"]');
      if (row) {
        dropdownButton = row.querySelector('[data-js-context-icon="true"]');
      }
    }

    if (!dropdownButton) {
      const icon = messageElement.querySelector('[data-icon="ic-chevron-down-menu"]');
      if (icon) {
        dropdownButton = icon.closest('[role="button"]');
      }
    }

    if (dropdownButton) {
      const messageContainer = messageElement.closest('.message-in, .message-out') ||
                               messageElement.closest('[class*="message"]') ||
                               messageElement;

      const mouseEnterEvent = new MouseEvent('mouseenter', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      messageContainer.dispatchEvent(mouseEnterEvent);

      const mouseOverEvent = new MouseEvent('mouseover', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: event.clientX,
        clientY: event.clientY
      });
      messageContainer.dispatchEvent(mouseOverEvent);

      setTimeout(() => {
        dropdownButton.click();
      }, 100);
    }
  }, true);
});
