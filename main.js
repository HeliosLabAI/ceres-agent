const { app, BrowserWindow, Menu, ipcMain, nativeImage, dialog } = require("electron");
const path = require("path");
const { exec, spawn } = require("child_process");
const fs = require("fs");

let mainWindow;

const createWindow = () => {
  // Load transparent icon - Windows will auto-size for taskbar
  const iconPath = path.join(__dirname, "icon.png");
  const appIcon = nativeImage.createFromPath(iconPath);
  
  // Windows taskbar typically uses: 16x16, 24x24, 32x32, 48x48
  // We provide a high-res source and Windows scales it
  const taskbarIcon = appIcon.resize({ width: 256, height: 256 });

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: "#ffffff",
    autoHideMenuBar: true,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      webSecurity: false
    }
  });

  mainWindow.loadFile("index.html");
  
  // Set icon after window loads for better taskbar display
  mainWindow.setIcon(taskbarIcon);
  
  // Remove the menu bar completely
  Menu.setApplicationMenu(null);
  
  // mainWindow.webContents.openDevTools();
  
  // Window control IPC handlers
  ipcMain.on('window-minimize', () => {
    mainWindow.minimize();
  });
  
  ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  
  ipcMain.on('window-close', () => {
    mainWindow.close();
  });
  
  // Terminal execution IPC handlers
  let pendingCommandResolve = null;
  let pendingCommandReject = null;
  
  // Handle command approval request from renderer
  ipcMain.handle('request-command-approval', async (event, { command, reason, cwd }) => {
    return new Promise((resolve, reject) => {
      pendingCommandResolve = resolve;
      pendingCommandReject = reject;
      // Send to renderer to show approval dialog
      mainWindow.webContents.send('show-command-dialog', { command, reason, cwd });
    });
  });
  
  // Handle user approval response from renderer
  ipcMain.handle('respond-command-approval', async (event, { approved, timeout = null }) => {
    if (pendingCommandResolve) {
      pendingCommandResolve({ approved, timeout });
      pendingCommandResolve = null;
      pendingCommandReject = null;
    }
  });
  
  // Execute terminal command with streaming output (no timeout limit)
  ipcMain.handle('execute-terminal', async (event, { command, cwd, timeout }) => {
    return new Promise((resolve, reject) => {
      const options = {
        cwd: cwd || process.cwd(),
        timeout: timeout,
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large output
        env: { ...process.env, FORCE_COLOR: 'true', npm_config_progress: 'true' }
      };
      
      let stdout = '';
      let stderr = '';
      
      const child = exec(command, options, (error, stdoutResult, stderrResult) => {
        stdout = stdoutResult;
        stderr = stderrResult;
        
        if (error) {
          resolve({
            success: false,
            exitCode: error.code,
            stdout: stdout,
            stderr: stderr,
            error: error.message
          });
        } else {
          resolve({
            success: true,
            exitCode: 0,
            stdout: stdout,
            stderr: stderr
          });
        }
      });
      
      // Stream stdout data in real-time
      if (child.stdout) {
        child.stdout.on('data', (data) => {
          const chunk = data.toString();
          stdout += chunk;
          // Send progress update to renderer
          event.sender.send('terminal-output', { 
            type: 'stdout', 
            data: chunk,
            command: command 
          });
        });
      }
      
      // Stream stderr data in real-time
      if (child.stderr) {
        child.stderr.on('data', (data) => {
          const chunk = data.toString();
          stderr += chunk;
          // Send progress update to renderer
          event.sender.send('terminal-output', { 
            type: 'stderr', 
            data: chunk,
            command: command 
          });
        });
      }
      
      // Handle optional timeout (if specified)
      let timeoutId;
      if (timeout && timeout > 0) {
        timeoutId = setTimeout(() => {
          child.kill();
          resolve({
            success: false,
            exitCode: -1,
            stdout: stdout,
            stderr: stderr + '\nCommand timed out after ' + (timeout / 1000) + ' seconds',
            error: 'Command execution timed out'
          });
        }, timeout);
        
        // Clear timeout on process exit
        child.on('exit', () => {
          clearTimeout(timeoutId);
        });
      }
    });
  });
};

// IPC handler for showing open folder dialog (returns real path)
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Project Folder'
  });
  
  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }
  
  const folderPath = result.filePaths[0];
  
  // Get folder name and list of files
  const folderName = path.basename(folderPath);
  let files = [];
  try {
    files = fs.readdirSync(folderPath);
  } catch (err) {
    console.error('Error reading folder:', err);
  }
  
  return {
    canceled: false,
    path: folderPath,
    name: folderName,
    files: files
  };
});

// IPC handlers for file operations
ipcMain.handle('fs-readFile', async (event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return { success: true, content };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('fs-writeFile', async (event, filePath, content) => {
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('fs-readdir', async (event, dirPath) => {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return { 
      success: true, 
      entries: entries.map(e => ({
        name: e.name,
        isDirectory: e.isDirectory(),
        isFile: e.isFile()
      }))
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('fs-mkdir', async (event, dirPath) => {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('fs-unlink', async (event, filePath) => {
  try {
    fs.unlinkSync(filePath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

app.whenReady().then(() => {
  // Set app icon for taskbar
  const iconPath = path.join(__dirname, "icon.png");
  const appIcon = nativeImage.createFromPath(iconPath);
  const taskbarIcon = appIcon.resize({ width: 256, height: 256 });
  app.setAppUserModelId('com.ceres.desktop');
  
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
