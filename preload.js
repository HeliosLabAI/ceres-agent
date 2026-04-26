const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("appMeta", {
  platform: process.platform
});

contextBridge.exposeInMainWorld("electronAPI", {
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  // Folder selection API (returns real path)
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  // File system operations
  readFile: (filePath) => ipcRenderer.invoke('fs-readFile', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('fs-writeFile', filePath, content),
  readDir: (dirPath) => ipcRenderer.invoke('fs-readdir', dirPath),
  mkdir: (dirPath) => ipcRenderer.invoke('fs-mkdir', dirPath),
  unlink: (filePath) => ipcRenderer.invoke('fs-unlink', filePath),
  // Terminal execution APIs
  requestCommandApproval: (data) => ipcRenderer.invoke('request-command-approval', data),
  respondCommandApproval: (data) => ipcRenderer.invoke('respond-command-approval', data),
  executeTerminal: (data) => ipcRenderer.invoke('execute-terminal', data),
  onShowCommandDialog: (callback) => ipcRenderer.on('show-command-dialog', (event, data) => callback(data)),
  onTerminalOutput: (callback) => ipcRenderer.on('terminal-output', (event, data) => callback(data))
});
