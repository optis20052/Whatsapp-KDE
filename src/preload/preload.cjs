const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendNotification: (data) => ipcRenderer.send('show-notification', data),
  updateBadge: (count) => ipcRenderer.send('update-badge', count),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  onNotificationClick: (callback) => ipcRenderer.on('notification-clicked', callback),
  saveTempImage: (data) => ipcRenderer.invoke('save-temp-image', data),
  copyImageToClipboard: (dataUrl) => ipcRenderer.invoke('copy-image-to-clipboard', dataUrl)
});

window.addEventListener('DOMContentLoaded', () => {
  let lastCount = 0;

  // Focus preservation: prevent input focus loss when new messages arrive
  let lastFocusedInput = null;
  let isUserInteracting = false;

  function isInputElement(el) {
    if (!el) return false;
    return el.isContentEditable ||
           el.tagName === 'INPUT' ||
           el.tagName === 'TEXTAREA' ||
           el.getAttribute('role') === 'textbox';
  }

  // Track when user focuses on an input/editable element
  document.addEventListener('focusin', (e) => {
    if (isInputElement(e.target)) {
      lastFocusedInput = e.target;
    }
  }, true);

  // Track user interactions to know when focus changes are intentional
  document.addEventListener('mousedown', () => {
    isUserInteracting = true;
    setTimeout(() => { isUserInteracting = false; }, 100);
  }, true);

  document.addEventListener('keydown', (e) => {
    // Tab key or Escape means intentional focus change
    if (e.key === 'Tab' || e.key === 'Escape') {
      isUserInteracting = true;
      setTimeout(() => { isUserInteracting = false; }, 100);
    }
  }, true);

  // Restore focus if it was unexpectedly lost (not by user action)
  document.addEventListener('focusout', (e) => {
    if (!lastFocusedInput) return;
    if (e.target !== lastFocusedInput) return;
    if (isUserInteracting) return; // User caused focus change, don't interfere

    const inputToRestore = lastFocusedInput;

    // Check after the focus has settled
    setTimeout(() => {
      const activeEl = document.activeElement;
      // If focus didn't go to another input element, restore it
      if (!isInputElement(activeEl)) {
        if (inputToRestore && document.contains(inputToRestore)) {
          inputToRestore.focus();
        }
      }
    }, 0);
  }, true);

  // Convert image to base64 data URL for clipboard
  async function imageToDataUrl(imgElement) {
    const src = imgElement.src;

    if (src.startsWith('data:')) {
      return src;
    }

    if (src.startsWith('blob:')) {
      try {
        const response = await fetch(src);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        return null;
      }
    }

    return null;
  }

  // Show context menu for copying image
  function showImageContextMenu(x, y, imgElement) {
    document.getElementById('electron-context-menu')?.remove();

    const menu = document.createElement('div');
    menu.id = 'electron-context-menu';
    menu.style.cssText = `position:fixed;left:${x}px;top:${y}px;background:#233138;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.4);z-index:999999;min-width:150px;padding:6px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`;

    const copyItem = document.createElement('div');
    copyItem.textContent = 'Copy Image';
    copyItem.style.cssText = `padding:10px 16px;cursor:pointer;color:#e9edef;font-size:14px`;
    copyItem.onmouseenter = () => copyItem.style.background = '#3b4a54';
    copyItem.onmouseleave = () => copyItem.style.background = 'transparent';
    copyItem.onclick = async () => {
      copyItem.textContent = 'Copying...';
      copyItem.style.pointerEvents = 'none';

      const dataUrl = await imageToDataUrl(imgElement);
      const success = dataUrl && (await ipcRenderer.invoke('copy-image-to-clipboard', dataUrl)).success;
      copyItem.textContent = success ? 'Copied!' : 'Failed';
      copyItem.style.color = success ? '#00a884' : '#ff6b6b';
      setTimeout(() => menu.remove(), 500);
    };

    menu.appendChild(copyItem);
    document.body.appendChild(menu);

    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = `${window.innerWidth - rect.width - 10}px`;
    if (rect.bottom > window.innerHeight) menu.style.top = `${window.innerHeight - rect.height - 10}px`;

    const removeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', removeMenu);
        document.removeEventListener('contextmenu', removeMenu);
      }
    };
    setTimeout(() => {
      document.addEventListener('click', removeMenu);
      document.addEventListener('contextmenu', removeMenu);
    }, 0);
  }

  // Check if element is inside the full-screen image viewer
  function isInFullScreenViewer(element) {
    let parent = element.parentElement;
    while (parent) {
      const style = window.getComputedStyle(parent);
      if (parseInt(style.zIndex) > 100 && style.position === 'fixed') return true;
      if (parent.getAttribute('role') === 'dialog' ||
          parent.getAttribute('aria-modal') === 'true') return true;
      parent = parent.parentElement;
    }
    return false;
  }

  // Right-click on images in full-screen viewer to copy
  document.addEventListener('contextmenu', (event) => {
    const imgElement = event.target.closest('img');
    if (!imgElement || !isInFullScreenViewer(imgElement)) return;

    event.preventDefault();
    event.stopPropagation();
    showImageContextMenu(event.clientX, event.clientY, imgElement);
  }, true);

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
