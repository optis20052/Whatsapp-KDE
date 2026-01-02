import { Tray, Menu, app, nativeImage, nativeTheme } from 'electron';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let tray = null;
let currentUnreadCount = 0;

// Detect desktop environment
function getDesktopEnvironment() {
  const xdgDesktop = process.env.XDG_CURRENT_DESKTOP || '';
  const desktopSession = process.env.DESKTOP_SESSION || '';
  
  if (xdgDesktop.toLowerCase().includes('kde') || desktopSession.toLowerCase().includes('plasma')) {
    return 'kde';
  }
  if (xdgDesktop.toLowerCase().includes('gnome') || desktopSession.toLowerCase().includes('gnome')) {
    return 'gnome';
  }
  if (xdgDesktop.toLowerCase().includes('xfce')) {
    return 'xfce';
  }
  if (xdgDesktop.toLowerCase().includes('cinnamon')) {
    return 'cinnamon';
  }
  return 'unknown';
}

function isKDEDarkTheme() {
  try {
    let scheme;
    try {
      scheme = execSync('kreadconfig6 --group "General" --key "ColorScheme"', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    } catch {
      scheme = execSync('kreadconfig5 --group "General" --key "ColorScheme"', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    }
    return scheme.toLowerCase().includes('dark');
  } catch {
    return null;
  }
}

function isGNOMEDarkTheme() {
  try {
    const colorScheme = execSync('gsettings get org.gnome.desktop.interface color-scheme', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    if (colorScheme.includes('prefer-dark')) {
      return true;
    }
    if (colorScheme.includes('prefer-light') || colorScheme.includes('default')) {
      return false;
    }
    
    const gtkTheme = execSync('gsettings get org.gnome.desktop.interface gtk-theme', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    return gtkTheme.toLowerCase().includes('dark');
  } catch {
    return null;
  }
}

function isDarkTheme() {
  const desktop = getDesktopEnvironment();
  
  if (desktop === 'kde') {
    const kdeResult = isKDEDarkTheme();
    if (kdeResult !== null) return kdeResult;
  }
  
  if (desktop === 'gnome' || desktop === 'cinnamon') {
    const gnomeResult = isGNOMEDarkTheme();
    if (gnomeResult !== null) return gnomeResult;
  }
  
  return nativeTheme.shouldUseDarkColors;
}

function getTrayIcon(unreadCount) {
  const isDark = isDarkTheme();
  let iconName;

  if (unreadCount > 0) {
    iconName = isDark ? 'icon-unread-dark.png' : 'icon-unread-light.png';
  } else {
    iconName = isDark ? 'icon-tray-dark.png' : 'icon-tray-light.png';
  }

  const iconPath = path.join(__dirname, '../assets/icons', iconName);
  if (!fs.existsSync(iconPath)) {
    iconName = unreadCount > 0 ? 'icon-unread.png' : 'icon-24x24.png';
  }

  return nativeImage.createFromPath(path.join(__dirname, '../assets/icons', iconName));
}

export function createTray(mainWindow) {
  const icon = getTrayIcon(0);

  tray = new Tray(icon);
  tray.setToolTip('WhatsApp');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show WhatsApp',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    {
      label: 'Hide WhatsApp',
      click: () => {
        mainWindow.hide();
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  return tray;
}

export function updateTrayIcon(unreadCount) {
  if (!tray) return;

  currentUnreadCount = unreadCount;
  tray.setImage(getTrayIcon(unreadCount));

  const tooltip = unreadCount > 0
    ? `WhatsApp (${unreadCount} unread)`
    : 'WhatsApp';
  tray.setToolTip(tooltip);
}

nativeTheme.on('updated', () => {
  setTimeout(() => {
    if (tray) {
      tray.setImage(getTrayIcon(currentUnreadCount));
    }
  }, 400);
});

export function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
