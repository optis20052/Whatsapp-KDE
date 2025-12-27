import { app, BrowserWindow } from 'electron';
import { exec } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import dbusNative from '@homebridge/dbus-native';

app.setName('whatsapp-electron');

import { createMainWindow, setupSession } from './window.js';
import { createTray, destroyTray } from './tray.js';
import { setupIpcHandlers } from './ipc-handlers.js';
import { registerShortcuts, unregisterShortcuts } from './shortcuts.js';
import { createMenu } from './menu.js';
import { setupAutoUpdater, stopAutoUpdater } from './updater.js';

// Check if running on KDE
function isKDE() {
  return process.env.XDG_CURRENT_DESKTOP?.toLowerCase().includes('kde') ||
         process.env.DESKTOP_SESSION?.toLowerCase().includes('plasma');
}

// Force activate window on KDE Wayland using KWin scripting
function forceActivateWindow() {
  if (!isKDE()) return;

  const script = `
var clients = workspace.windowList();
for (var i = 0; i < clients.length; i++) {
  var w = clients[i];
  if (w.resourceClass === 'whatsapp-electron' || w.resourceClass === 'whatsapp-electron-kde') {
    workspace.activeWindow = w;
    w.minimized = false;
    break;
  }
}
`;
  const scriptPath = path.join(os.tmpdir(), 'whatsapp-activate.js');
  fs.writeFileSync(scriptPath, script);

  exec(`qdbus6 org.kde.KWin /Scripting org.kde.kwin.Scripting.unloadScript whatsapp-activate`, { shell: '/bin/bash' }, () => {
    exec(`qdbus6 org.kde.KWin /Scripting org.kde.kwin.Scripting.loadScript "${scriptPath}" whatsapp-activate`, { shell: '/bin/bash' }, (err, stdout) => {
      const scriptId = (stdout || '').trim();
      if (scriptId) {
        exec(`qdbus6 org.kde.KWin /Scripting org.kde.kwin.Scripting.start`, { shell: '/bin/bash' }, () => {
          exec(`qdbus6 org.kde.KWin /Scripting/Script${scriptId} org.kde.kwin.Script.run`, { shell: '/bin/bash' }, () => {
            setTimeout(() => {
              exec(`qdbus6 org.kde.KWin /Scripting org.kde.kwin.Scripting.unloadScript whatsapp-activate`, { shell: '/bin/bash' }, () => {});
            }, 500);
          });
        });
      }
    });
  });
}

let mainWindow = null;

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    setupSession();
    mainWindow = createMainWindow();
    createTray(mainWindow);
    setupIpcHandlers(mainWindow);
    registerShortcuts(mainWindow);
    createMenu(mainWindow);
    setupAutoUpdater(mainWindow);

    // On KDE Wayland, listen for notification clicks via DBus and force-activate window
    if (process.platform === 'linux') {
      try {
        const sessionBus = dbusNative.sessionBus();
        sessionBus.addMatch("type='signal',interface='org.freedesktop.Notifications',member='ActionInvoked'", () => {});
        sessionBus.connection.on('message', (msg) => {
          if (msg.interface === 'org.freedesktop.Notifications' && msg.member === 'ActionInvoked') {
            if (mainWindow) {
              forceActivateWindow();
            }
          }
        });
      } catch (error) {
        // DBus not available
      }
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });

  app.on('will-quit', () => {
    unregisterShortcuts();
    stopAutoUpdater();
    destroyTray();
  });

  process.on('SIGINT', () => app.quit());
  process.on('SIGTERM', () => app.quit());
}

process.on('uncaughtException', () => {});

app.on('render-process-gone', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.reload();
  }
});

app.on('child-process-gone', () => {});
