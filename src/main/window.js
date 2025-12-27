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
