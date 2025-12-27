import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import { dialog, Notification } from 'electron';

let updateCheckInterval = null;

export function setupAutoUpdater(mainWindow) {
  if (process.env.NODE_ENV === 'development') {
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  setTimeout(() => checkForUpdates(), 5000);

  updateCheckInterval = setInterval(() => checkForUpdates(), 4 * 60 * 60 * 1000);

  autoUpdater.on('update-available', (info) => {
    const notification = new Notification({
      title: 'Update Available',
      body: `WhatsApp version ${info.version} is available. Click to download.`
    });

    notification.on('click', () => {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Available',
        message: `Version ${info.version} is available. Download now?`,
        detail: 'The update will be downloaded in the background.',
        buttons: ['Download', 'Later']
      }).then((result) => {
        if (result.response === 0) {
          autoUpdater.downloadUpdate();
        }
      });
    });

    notification.show();
  });

  autoUpdater.on('update-not-available', () => {});

  autoUpdater.on('download-progress', (progressObj) => {
    mainWindow.setProgressBar(progressObj.percent / 100);
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow.setProgressBar(-1);

    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded successfully',
      detail: 'The application will restart to install the update.',
      buttons: ['Restart Now', 'Restart Later']
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', () => {});
}

function checkForUpdates() {
  autoUpdater.checkForUpdates().catch(() => {});
}

export function stopAutoUpdater() {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }
}
