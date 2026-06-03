const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getScreenSize: () => ipcRenderer.invoke('get-screen-size'),
  getCapabilities: () => ipcRenderer.invoke('get-capabilities'),
  sendControlEvent: (event) => ipcRenderer.send('control-event', event),
  checkScreenPermission: () => ipcRenderer.invoke('check-screen-permission'),
  requestScreenPermission: () => ipcRenderer.invoke('request-screen-permission'),
  openScreenPermission: () => ipcRenderer.invoke('open-screen-permission'),
  openAccessibilityPermission: () => ipcRenderer.invoke('open-accessibility-permission'),
  promptRestart: () => ipcRenderer.invoke('prompt-restart'),
  saveFile: (filename, buffer) => ipcRenderer.invoke('save-file', { filename, buffer }),
});
