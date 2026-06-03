const {
  app, BrowserWindow, ipcMain, desktopCapturer, screen, systemPreferences, shell, dialog
} = require('electron');
const path = require('path');

let robot = null;
try {
  robot = require('@jitsi/robotjs');
  robot.setMouseDelay(0);
  robot.setKeyboardDelay(0);
  console.log('[robotjs] Remote control enabled');
} catch (e) {
  console.warn('[robotjs] Not available — view-only mode');
}

let mainWindow;

function createWindow() {
  const isMac = process.platform === 'darwin';
  mainWindow = new BrowserWindow({
    width: 860,
    height: 560,
    minWidth: 680,
    minHeight: 460,
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Auto-handle screen capture — checks permission first, triggers native prompt if needed
  mainWindow.webContents.setDisplayMediaRequestHandler(async (_req, callback) => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen'] });
      if (!sources || sources.length === 0) {
        callback({});
        return;
      }
      callback({ video: sources[0] });
    } catch (err) {
      callback({});
    }
  });
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    const status = systemPreferences.getMediaAccessStatus('screen');
    console.log(`[macOS] Screen recording permission: ${status}`);
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── IPC ───────────────────────────────────────────────────────────────────────

ipcMain.handle('get-screen-size', () => screen.getPrimaryDisplay().size);

ipcMain.handle('get-capabilities', () => ({ remoteControl: robot !== null, platform: process.platform }));

// Check current screen recording permission status
ipcMain.handle('check-screen-permission', () => {
  if (process.platform !== 'darwin') return 'granted';
  return systemPreferences.getMediaAccessStatus('screen');
});

// Trigger native macOS permission prompt by calling desktopCapturer
// Returns 'granted' | 'denied' | 'not-determined'
ipcMain.handle('request-screen-permission', async () => {
  if (process.platform !== 'darwin') return 'granted';
  const before = systemPreferences.getMediaAccessStatus('screen');
  if (before === 'granted') return 'granted';

  // Calling getSources triggers the native permission dialog on first run
  try {
    await desktopCapturer.getSources({ types: ['screen'] });
  } catch (_) {}

  return systemPreferences.getMediaAccessStatus('screen');
});

// Open System Preferences to the Screen Recording pane
ipcMain.handle('open-screen-permission', () => {
  shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
});

// Open System Preferences to the Accessibility pane
ipcMain.handle('open-accessibility-permission', () => {
  shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
});

// Show a native restart dialog after granting permission
ipcMain.handle('prompt-restart', async () => {
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'info',
    buttons: ['Restart Now', 'Later'],
    defaultId: 0,
    title: 'Permission Granted',
    message: 'Screen Recording permission granted!',
    detail: 'Desktop Viewer needs to restart to apply the new permission.',
  });
  if (response === 0) {
    app.relaunch();
    app.exit(0);
  }
});

ipcMain.on('control-event', (_, event) => {
  if (!robot) return;
  try { injectEvent(event); } catch (_) {}
});

function injectEvent({ type, x, y, button, key, modifiers = [], deltaX = 0, deltaY = 0 }) {
  const { width, height } = screen.getPrimaryDisplay().size;
  switch (type) {
    case 'mousemove':
      robot.moveMouse(Math.round(x * width), Math.round(y * height));
      break;
    case 'mousedown':
      robot.moveMouse(Math.round(x * width), Math.round(y * height));
      robot.mouseToggle('down', mapBtn(button));
      break;
    case 'mouseup':
      robot.moveMouse(Math.round(x * width), Math.round(y * height));
      robot.mouseToggle('up', mapBtn(button));
      break;
    case 'dblclick':
      robot.moveMouse(Math.round(x * width), Math.round(y * height));
      robot.mouseClick(mapBtn(button), true);
      break;
    case 'scroll':
      robot.scrollMouse(Math.round(deltaX), Math.round(deltaY));
      break;
    case 'keydown':
      robot.keyToggle(mapKey(key), 'down', modifiers.map(mapMod));
      break;
    case 'keyup':
      robot.keyToggle(mapKey(key), 'up', []);
      break;
  }
}

function mapBtn(b)  { return b === 2 ? 'right' : b === 1 ? 'middle' : 'left'; }
function mapMod(m)  { return ({ ctrl:'control', alt:'alt', shift:'shift', meta: process.platform === 'darwin' ? 'command' : 'win' })[m] || m; }
function mapKey(k) {
  if (!k) return '';
  const m = {
    Enter:'enter', Backspace:'backspace', Delete:'delete', Tab:'tab',
    Escape:'escape', ' ':'space', ArrowLeft:'left', ArrowRight:'right',
    ArrowUp:'up', ArrowDown:'down', Home:'home', End:'end',
    PageUp:'pageup', PageDown:'pagedown',
    F1:'f1',F2:'f2',F3:'f3',F4:'f4',F5:'f5',F6:'f6',
    F7:'f7',F8:'f8',F9:'f9',F10:'f10',F11:'f11',F12:'f12',
    Control:'control', Alt:'alt', Shift:'shift',
    Meta: process.platform === 'darwin' ? 'command' : 'win'
  };
  return m[k] || k.toLowerCase();
}

// Save received file to disk via native save dialog
ipcMain.handle('save-file', async (_, { filename, buffer }) => {
  const fs = require('fs');
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: filename,
    buttonLabel: 'Save',
  });
  if (!filePath) return { saved: false };
  try {
    fs.writeFileSync(filePath, Buffer.from(buffer));
    return { saved: true, filePath };
  } catch (err) {
    return { saved: false, error: err.message };
  }
});
