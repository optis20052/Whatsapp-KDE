import { app, BrowserWindow } from 'electron';

app.setName('whatsapp-electron');

import { createMainWindow, setupSession } from './window.js';
import { createTray, destroyTray } from './tray.js';
import { setupIpcHandlers } from './ipc-handlers.js';
import { registerShortcuts, unregisterShortcuts } from './shortcuts.js';
import { createMenu } from './menu.js';
import { setupAutoUpdater, stopAutoUpdater } from './updater.js';

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
