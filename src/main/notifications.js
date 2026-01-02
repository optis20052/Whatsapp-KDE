import path from 'path';
import { fileURLToPath } from 'url';
import dbusNative from '@homebridge/dbus-native';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Track our notification IDs so we only respond to our own notifications
export const activeNotificationIds = new Set();
// Store metadata (tag, mainWindow) separately
const notificationMeta = new Map();

// DBus session bus and notifications interface
let sessionBus = null;
let notificationsInterface = null;
let interfaceReady = false;

function getIconPath() {
  return path.join(__dirname, '../assets/icons/icon.png');
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

function sendNotification(title, body, tag, mainWindow) {
  notificationsInterface.Notify(
    'WhatsApp',
    0,
    getIconPath(),
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

export function showNotification(data, mainWindow) {
  const { title, body, tag } = data;

  if (process.platform !== 'linux') {
    return;
  }

  if (!sessionBus) {
    initNotifications();
  }

  if (interfaceReady && notificationsInterface) {
    sendNotification(title, body, tag, mainWindow);
    return;
  }

  // Interface not ready yet - wait a bit and retry (up to 500ms)
  let attempts = 0;
  const maxAttempts = 10;
  const retryInterval = setInterval(() => {
    attempts++;
    if (interfaceReady && notificationsInterface) {
      clearInterval(retryInterval);
      sendNotification(title, body, tag, mainWindow);
    } else if (attempts >= maxAttempts) {
      clearInterval(retryInterval);
      if (notificationsInterface) {
        sendNotification(title, body, tag, mainWindow);
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
