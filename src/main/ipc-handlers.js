import { ipcMain, app } from 'electron';
import { showNotification } from './notifications.js';
import { updateTrayIcon } from './tray.js';
import { exec } from 'child_process';
import dbusNative from '@homebridge/dbus-native';

let currentBadgeCount = 0;
let sessionBus = null;

try {
  sessionBus = dbusNative.sessionBus();
} catch (error) {
  // DBus not available
}

function setKDEBadge(count, urgent = false) {
  const desktopFile = 'whatsapp-electron.desktop';
  const appUri = `application://${desktopFile}`;

  if (sessionBus && sessionBus.connection) {
    try {
      sessionBus.connection.message({
        type: 4,
        path: '/com/canonical/unity/launcherentry/whatsapp_electron',
        interface: 'com.canonical.Unity.LauncherEntry',
        member: 'Update',
        signature: 'sa{sv}',
        body: [
          appUri,
          [
            ['count', ['x', count]],
            ['count-visible', ['b', count > 0]],
            ['urgent', ['b', urgent]]
          ]
        ]
      });
    } catch (error) {
      // Fallback to gdbus
    }
  }

  const gdbusCmd = `gdbus emit --session --object-path /com/canonical/unity/launcherentry/whatsapp_electron ` +
    `--signal com.canonical.Unity.LauncherEntry.Update ` +
    `"${appUri}" "{'count': <int64 ${count}>, 'count-visible': <${count > 0}>, 'urgent': <${urgent}>}"`;

  exec(gdbusCmd, () => {});
}

export function setupIpcHandlers(mainWindow) {
  // Reset badge count on startup
  updateBadgeCount(0, mainWindow);

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  ipcMain.on('update-badge', (event, count) => {
    updateBadgeCount(count, mainWindow);
  });

  ipcMain.on('show-notification', (event, data) => {
    showNotification(data, mainWindow);
  });
}

function updateBadgeCount(count, mainWindow) {
  const isNewMessage = count > currentBadgeCount;
  const isUrgent = isNewMessage && mainWindow && !mainWindow.isFocused();

  if (isUrgent) {
    mainWindow.flashFrame(true);
  }

  currentBadgeCount = count;

  if (process.platform === 'linux') {
    try {
      app.setBadgeCount(count);
    } catch (error) {
      // Badge count not supported
    }
    setKDEBadge(count, isUrgent);
  }

  const title = count > 0 ? `(${count}) WhatsApp` : 'WhatsApp';
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setTitle(title);
  }

  updateTrayIcon(count);

  // Clear urgent state when window is focused
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.once('focus', () => {
      mainWindow.flashFrame(false);
      if (process.platform === 'linux') {
        setKDEBadge(currentBadgeCount, false);
      }
    });
  }
}
