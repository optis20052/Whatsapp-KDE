import { Notification } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function showNotification(data, mainWindow) {
  const { title, body, tag } = data;

  const notification = new Notification({
    title: title || 'WhatsApp',
    body: body || '',
    icon: path.join(__dirname, '../assets/icons/icon.png'),
    urgency: 'normal',
    sound: true,
    timeoutType: 'default'
  });

  notification.on('click', () => {
    mainWindow.show();
    mainWindow.focus();

    if (tag) {
      mainWindow.webContents.send('notification-clicked', tag);
    }
  });

  notification.show();
}
