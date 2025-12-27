# WhatsApp Electron

A feature-rich WhatsApp Desktop client for Linux, specifically optimized for KDE Plasma.

## Features

- **WhatsApp Web Integration** - Full WhatsApp Web functionality in a native app
- **System Notifications** - Native Linux notifications via libnotify
- **System Tray Icon** - Minimize to tray with unread message indicator
- **Taskbar Badge Count** - Unread message count on taskbar icon
- **Auto-Updater** - Automatic updates for AppImage builds
- **Keyboard Shortcuts** - Global and local shortcuts for quick access
- **Spell Checker** - Built-in spell checking powered by Chromium
- **Close to Tray** - App continues running in background when closed
- **Window State Persistence** - Remembers window size, position, and maximized state
- **KDE Plasma Integration** - Designed for KDE with proper theme integration

## Screenshots

_Add screenshots here after running the app_

## Installation

### Prerequisites

- Node.js 18 or higher
- npm
- Ubuntu with KDE Plasma (5 or 6)
- `libunity9` (for taskbar badge count on Plasma 5)

To install libunity9 on Ubuntu:

```bash
sudo apt install libunity9
```

### Install from Source

1. Clone the repository:
```bash
git clone https://github.com/yourusername/whatsapp-electron.git
cd whatsapp-electron
```

2. Install dependencies:
```bash
npm install
```

3. Run the application:
```bash
npm start
```

### Build Packages

Build AppImage:
```bash
npm run build:appimage
```

Build .deb package:
```bash
npm run build:deb
```

Build both:
```bash
npm run build
```

The built packages will be in the `dist/` directory.

### Install AppImage

```bash
chmod +x dist/whatsapp-electron-*.AppImage
./dist/whatsapp-electron-*.AppImage
```

### Install .deb Package

```bash
sudo dpkg -i dist/whatsapp-electron_*.deb
```

## Usage

### Running the App

After installation, you can:
- Launch from application menu
- Run `npm start` from source directory
- Execute the AppImage directly

### Keyboard Shortcuts

- **Ctrl+Shift+W** - Toggle window visibility (global)
- **Ctrl+H** - Hide window
- **Ctrl+Q** - Quit application
- **Ctrl+F** - Search (WhatsApp's native search)
- **Ctrl+R** - Reload
- **Ctrl+Shift+I** - Toggle Developer Tools
- **F11** - Toggle fullscreen

Standard editing shortcuts (Ctrl+C, Ctrl+V, Ctrl+X, etc.) work as expected.

### System Tray

The app runs in the system tray and provides:
- Left-click to toggle window visibility
- Right-click for context menu
- Tray icon changes when you have unread messages
- Tooltip shows unread message count

### Closing the App

By default, closing the window minimizes the app to the system tray. To fully quit:
- Right-click tray icon and select "Quit"
- Use Ctrl+Q keyboard shortcut
- Select File > Quit from menu

## Configuration

The app stores configuration in:
```
~/.config/whatsapp-electron/
```

This includes:
- Window state (size, position, maximized)
- User preferences
- Session data

## Development

### Development Mode

Run in development mode with DevTools open:
```bash
npm run dev
```

Or set the environment variable:
```bash
NODE_ENV=development npm start
```

### Project Structure

```
whatsapp-electron/
├── src/
│   ├── main/           # Main process (Electron backend)
│   │   ├── index.js    # Entry point
│   │   ├── window.js   # Window management
│   │   ├── tray.js     # System tray
│   │   ├── notifications.js  # Notifications
│   │   ├── shortcuts.js      # Keyboard shortcuts
│   │   ├── menu.js           # Application menu
│   │   ├── ipc-handlers.js   # IPC communication
│   │   └── updater.js        # Auto-updater
│   ├── preload/        # Preload scripts (security bridge)
│   │   └── preload.js
│   ├── renderer/       # Renderer customizations
│   │   └── inject.css  # Custom CSS
│   └── assets/         # Icons and resources
│       └── icons/
├── build/              # Build resources
│   └── icons/
├── package.json
└── README.md
```

### Security

The app implements Electron security best practices:
- Context isolation enabled
- Node integration disabled in renderer
- Sandbox enabled
- Web security enforced
- Navigation restricted to WhatsApp Web
- Secure IPC communication via context bridge

## Troubleshooting

### Badge count not showing

On KDE Plasma 5, install libunity9:
```bash
sudo apt install libunity9
```

On KDE Plasma 6, badge count should work natively.

### Notifications not appearing

Check your KDE notification settings:
1. System Settings > Notifications
2. Ensure notifications are enabled
3. Check Do Not Disturb mode is off

### Tray icon not appearing

Ensure your system tray is enabled in KDE:
1. Right-click on panel
2. Enter Edit Mode
3. Add "System Tray" widget if missing

### App won't start

Check if another instance is running:
```bash
pkill -f whatsapp-electron
```

Clear configuration and try again:
```bash
rm -rf ~/.config/whatsapp-electron
```

## Updates

### AppImage Auto-Updates

AppImage builds support automatic updates. The app will:
- Check for updates on startup and every 4 hours
- Notify you when an update is available
- Download updates in the background
- Prompt you to restart when ready

### .deb Package Updates

.deb packages should be updated through your system's package manager (apt).

## Building for Distribution

### Requirements

- Ensure icons are in place (see `src/assets/icons/README.md`)
- Update version in `package.json`
- Configure GitHub repository in `package.json` for auto-updates

### GitHub Releases

For auto-updates to work:
1. Create a GitHub repository
2. Update `package.json` with your repository details
3. Build and upload releases to GitHub
4. AppImage builds will auto-update from GitHub releases

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - See LICENSE file for details

## Credits

- Built with [Electron](https://www.electronjs.org/)
- Uses [WhatsApp Web](https://web.whatsapp.com/)
- Packaged with [electron-builder](https://www.electron.build/)

## Disclaimer

This is an unofficial WhatsApp client. WhatsApp and the WhatsApp logo are trademarks of WhatsApp LLC.

## Support

For issues and feature requests, please use the [GitHub issue tracker](https://github.com/yourusername/whatsapp-electron/issues).

## Privacy

This app:
- Does not collect any personal data
- Does not track your usage
- Does not send data to third parties
- All communication is directly with WhatsApp's servers
- Session data is stored locally on your machine

## System Requirements

### Minimum

- Ubuntu 20.04 or newer with KDE Plasma
- 2 GB RAM
- 500 MB disk space
- Internet connection

### Recommended

- Ubuntu 22.04 or newer with KDE Plasma 5.24+
- 4 GB RAM
- 1 GB disk space
- Broadband internet connection

## Known Issues

- Badge count requires libunity9 on KDE Plasma 5
- Some KDE themes may affect tray icon appearance
- Auto-updater only works with AppImage builds

## Roadmap

- [ ] Multi-account support
- [ ] Custom notification sounds
- [ ] Themes/appearance customization
- [ ] Export chat history
- [ ] KDE Connect integration
- [ ] Flatpak packaging
- [ ] Snap packaging

## Version History

### 1.0.0 (Current)

Initial release with:
- WhatsApp Web integration
- System notifications
- System tray icon
- Taskbar badge count
- Auto-updater
- Keyboard shortcuts
- Spell checker
- KDE Plasma integration
