import { Tray, Menu, app, nativeImage, Notification } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let tray = null;
let isFirstClose = true;

export function createTray(mainWindow) {
  const iconPath = path.join(__dirname, '../assets/icons/icon-24x24.png');
  const icon = nativeImage.createFromPath(iconPath);

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

      if (isFirstClose) {
        const notification = new Notification({
          title: 'WhatsApp is still running',
          body: 'Click the system tray icon to open WhatsApp again',
          icon: iconPath
        });
        notification.show();
        isFirstClose = false;
      }
    }
  });

  return tray;
}

export function updateTrayIcon(unreadCount) {
  if (!tray) return;

  const iconName = unreadCount > 0 ? 'icon-unread.png' : 'icon-24x24.png';
  const iconPath = path.join(__dirname, '../assets/icons', iconName);
  const icon = nativeImage.createFromPath(iconPath);
  tray.setImage(icon);

  const tooltip = unreadCount > 0
    ? `WhatsApp (${unreadCount} unread)`
    : 'WhatsApp';
  tray.setToolTip(tooltip);
}

export function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
