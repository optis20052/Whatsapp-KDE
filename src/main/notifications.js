import path from 'path';
import fs from 'fs';
import os from 'os';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';
import dbusNative from '@homebridge/dbus-native';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache directory for profile pictures
const cacheDir = path.join(os.tmpdir(), 'whatsapp-electron-icons');
try {
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
} catch (e) {}

// Track our notification IDs so we only respond to our own notifications
export const activeNotificationIds = new Set();
// Store metadata (tag, mainWindow) separately
const notificationMeta = new Map();

// DBus session bus and notifications interface
let sessionBus = null;
let notificationsInterface = null;
let interfaceReady = false;

function getDefaultIconPath() {
  return path.join(__dirname, '../assets/icons/icon.png');
}

// Download or decode icon and save to cache
function resolveIcon(iconData, tag) {
  return new Promise((resolve) => {
    if (!iconData) {
      resolve(getDefaultIconPath());
      return;
    }

    const cacheFile = path.join(cacheDir, `${tag.replace(/[^a-zA-Z0-9]/g, '_')}.png`);

    // Handle data URL (base64)
    if (iconData.startsWith('data:image')) {
      try {
        const matches = iconData.match(/^data:image\/\w+;base64,(.+)$/);
        if (matches && matches[1]) {
          fs.writeFileSync(cacheFile, Buffer.from(matches[1], 'base64'));
          resolve(cacheFile);
          return;
        }
      } catch (e) {}
      resolve(getDefaultIconPath());
      return;
    }

    // Handle blob URL - can't fetch from main process, use default
    if (iconData.startsWith('blob:')) {
      resolve(getDefaultIconPath());
      return;
    }

    // Handle regular URL
    if (iconData.startsWith('http://') || iconData.startsWith('https://')) {
      const protocol = iconData.startsWith('https://') ? https : http;
      const request = protocol.get(iconData, (response) => {
        if (response.statusCode === 200) {
          const chunks = [];
          response.on('data', (chunk) => chunks.push(chunk));
          response.on('end', () => {
            try {
              fs.writeFileSync(cacheFile, Buffer.concat(chunks));
              resolve(cacheFile);
            } catch (e) {
              resolve(getDefaultIconPath());
            }
          });
        } else {
          resolve(getDefaultIconPath());
        }
      });
      request.on('error', () => resolve(getDefaultIconPath()));
      request.setTimeout(3000, () => {
        request.destroy();
        resolve(getDefaultIconPath());
      });
      return;
    }

    resolve(getDefaultIconPath());
  });
}

// Initialize session bus and get interface
function initNotifications() {
  if (process.platform !== 'linux') return;
  if (sessionBus !== null) return; // Already initialized or failed

  try {
    sessionBus = dbusNative.sessionBus();
    sessionBus.getInterface(
      'org.freedesktop.Notifications',
      '/org/freedesktop/Notifications',
      'org.freedesktop.Notifications',
      (err, iface) => {
        if (!err && iface) {
          notificationsInterface = iface;
          interfaceReady = true;
        }
      }
    );
  } catch (error) {
    sessionBus = false;
  }
}

// Initialize on module load
initNotifications();

function sendNotification(title, body, tag, mainWindow, iconPath) {
  notificationsInterface.Notify(
    'WhatsApp',
    0,
    iconPath || getDefaultIconPath(),
    title || 'WhatsApp',
    body || '',
    ['default', 'Open'],
    {
      'urgency': 1,
      'desktop-entry': 'whatsapp-electron'
    },
    -1,
    (err, notificationId) => {
      if (!err && notificationId) {
        activeNotificationIds.add(notificationId);
        if (tag) {
          notificationMeta.set(notificationId, { tag, mainWindow });
        }
      }
    }
  );
}

export async function showNotification(data, mainWindow) {
  const { title, body, tag, icon } = data;

  if (process.platform !== 'linux') {
    return;
  }

  if (!sessionBus) {
    initNotifications();
  }

  // Resolve icon (download/decode if needed)
  const iconPath = await resolveIcon(icon, tag || 'default');

  if (interfaceReady && notificationsInterface) {
    sendNotification(title, body, tag, mainWindow, iconPath);
    return;
  }

  // Interface not ready yet - wait a bit and retry (up to 500ms)
  let attempts = 0;
  const maxAttempts = 10;
  const retryInterval = setInterval(() => {
    attempts++;
    if (interfaceReady && notificationsInterface) {
      clearInterval(retryInterval);
      sendNotification(title, body, tag, mainWindow, iconPath);
    } else if (attempts >= maxAttempts) {
      clearInterval(retryInterval);
      if (notificationsInterface) {
        sendNotification(title, body, tag, mainWindow, iconPath);
      }
    }
  }, 50);
}

// Get metadata for a notification
export function getNotificationMeta(id) {
  return notificationMeta.get(id);
}

// Remove notification ID when closed
export function removeNotificationId(id) {
  activeNotificationIds.delete(id);
  notificationMeta.delete(id);
}
