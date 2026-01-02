import { BrowserWindow, shell, session } from 'electron';
import Store from 'electron-store';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const store = new Store();

export function createMainWindow() {
  const defaultBounds = { width: 1200, height: 800 };
  const windowState = store.get('windowState') || defaultBounds;

  const win = new BrowserWindow({
    width: windowState.width || 1200,
    height: windowState.height || 800,
    x: windowState.x,
    y: windowState.y,
    minWidth: 800,
    minHeight: 600,
    show: false,
    backgroundColor: '#111b21',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '../assets/icons/icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, '../preload/preload.cjs'),
      spellcheck: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  if (process.platform === 'linux') {
    win.setIcon(path.join(__dirname, '../assets/icons/icon.png'));
  }

  win.webContents.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  win.loadURL('https://web.whatsapp.com');

  let shown = false;
  const showWindow = () => {
    if (shown) return;
    shown = true;
    win.show();
    win.focus();
    if (store.get('windowMaximized', false)) {
      win.maximize();
    }
  };

  win.once('ready-to-show', showWindow);

  // Fallback: show window after 3 seconds if ready-to-show didn't fire
  setTimeout(showWindow, 3000);

  win.webContents.on('did-finish-load', () => {
    const cssPath = path.join(__dirname, '../renderer/inject.css');
    try {
      if (fs.existsSync(cssPath)) {
        win.webContents.insertCSS(fs.readFileSync(cssPath, 'utf8'));
      }
    } catch (error) {
      // CSS injection failed
    }

    // Inject Notification override into the page's main world
    // This intercepts WhatsApp's notifications and routes them through our IPC
    win.webContents.executeJavaScript(`
      (function() {
        window.__notificationHandlers = window.__notificationHandlers || {};

        window.Notification = function(title, options) {
          options = options || {};
          const self = this;
          const tag = options.tag || null;

          if (window.electronAPI && window.electronAPI.sendNotification) {
            const iconUrl = options.icon || null;

            // Convert blob URL to data URL if needed
            if (iconUrl && iconUrl.startsWith('blob:')) {
              fetch(iconUrl)
                .then(r => r.blob())
                .then(blob => {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    window.electronAPI.sendNotification({
                      title: title,
                      body: options.body || '',
                      tag: tag,
                      icon: reader.result
                    });
                  };
                  reader.readAsDataURL(blob);
                })
                .catch(() => {
                  window.electronAPI.sendNotification({
                    title: title,
                    body: options.body || '',
                    tag: tag,
                    icon: null
                  });
                });
            } else {
              window.electronAPI.sendNotification({
                title: title,
                body: options.body || '',
                tag: tag,
                icon: iconUrl
              });
            }
          }

          this.title = title;
          this.body = options.body;
          this.tag = tag;
          this._onclick = null;

          Object.defineProperty(this, 'onclick', {
            get: function() { return self._onclick; },
            set: function(fn) {
              self._onclick = fn;
              if (tag && fn) {
                window.__notificationHandlers[tag] = { handler: fn, title: title };
              }
            }
          });

          this.addEventListener = function(type, handler) {
            if (type === 'click' && tag && handler) {
              window.__notificationHandlers[tag] = { handler: handler, title: title };
            }
          };

          this.removeEventListener = function() {};
          this.onclose = null;
          this.onerror = null;
          this.onshow = null;
          this.close = function() {};

          setTimeout(() => {
            if (this.onshow) this.onshow({ target: this });
          }, 100);

          return this;
        };

        window.Notification.permission = 'granted';
        window.Notification.requestPermission = function(cb) {
          if (cb) cb('granted');
          return Promise.resolve('granted');
        };

        if (window.electronAPI && window.electronAPI.onNotificationClick) {
          window.electronAPI.onNotificationClick((event, tag) => {
            const data = window.__notificationHandlers[tag];
            if (data && data.handler) {
              try {
                data.handler({ target: { tag: tag } });
              } catch(e) {}
            } else {
              // Fallback: find and click the chat by title
              const title = data ? data.title : null;
              if (title) {
                const chatEl = document.querySelector('[title="' + title + '"]');
                if (chatEl) {
                  const row = chatEl.closest('[role="row"]');
                  if (row) { row.click(); return; }
                }
              }
              const phone = tag.replace('@c.us', '').replace('@g.us', '');
              const chatByPhone = document.querySelector('[title*="' + phone + '"]');
              if (chatByPhone) {
                const row = chatByPhone.closest('[role="row"]');
                if (row) { row.click(); }
              }
            }
          });
        }
      })();
    `).catch(() => {});
  });

  win.on('close', () => {
    if (!win.isMaximized()) {
      store.set('windowState', win.getBounds());
    }
    store.set('windowMaximized', win.isMaximized());
  });

  win.on('maximize', () => store.set('windowMaximized', true));
  win.on('unmaximize', () => store.set('windowMaximized', false));

  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('https://web.whatsapp.com')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools();
  }

  win.webContents.session.setDevicePermissionHandler(() => true);

  win.webContents.session.on('select-hid-device', (event, details, callback) => {
    callback(details.deviceList[0]?.deviceId);
  });

  return win;
}

export function setupSession() {
  session.defaultSession.setSpellCheckerLanguages(['en-US']);

  const allowedPermissions = [
    'notifications',
    'media',
    'mediaKeySystem',
    'audioCapture',
    'display-capture',
    'pointerLock'
  ];

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(allowedPermissions.includes(permission));
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    return allowedPermissions.includes(permission);
  });
}
