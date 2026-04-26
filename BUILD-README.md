# Ceres AI Agent - Build & Installation Guide

## Quick Start - Build Installer

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Create Icon (Optional but Recommended)

**Option A - Automatic (PowerShell)**
```powershell
# Run the PowerShell script
.\build\create-simple-icon.ps1

# Or use ImageMagick if installed
magick convert assets/icon.svg assets/icon.ico
```

**Option B - Online Converter (Easiest)**
1. Open `assets/icon.svg` in your browser
2. Take a screenshot or save as PNG
3. Go to: https://cloudconvert.com/png-to-ico
4. Upload and convert to ICO with all sizes: 16,32,48,64,128,256
5. Save as `assets/icon.ico`

### Step 3: Build Installer

**Windows (Interactive Installer)**
```bash
npm run build:win
# or
.\build-installer.bat
```

**Output files:**
- `dist/Ceres AI Agent Setup.exe` - Full installer with wizard
- `dist/Ceres AI Agent.exe` - Portable version (no install needed)

**macOS (DMG)**
```bash
npm run build:mac
```

**Linux (AppImage)**
```bash
npm run build:linux
```

## Installation Features

### Windows Installer (NSIS)
- ✅ Beautiful setup wizard
- ✅ Choose installation directory
- ✅ Desktop shortcut creation
- ✅ Start menu entry
- ✅ File associations (.ceres files)
- ✅ Clean uninstaller
- ✅ Launch after install option

### Portable Version
- ✅ No installation required
- ✅ Run from USB drive
- ✅ No registry changes
- ✅ All data in one folder

## Customizing the Installer

### Edit Installer UI
- Edit `build/installer.nsh` for custom NSIS scripts
- Modify `build/installer.html` for splash screen
- Change `LICENSE.txt` for custom license

### Change App Details
Edit `package.json`:
```json
{
  "productName": "Your App Name",
  "version": "1.0.0",
  "description": "Your app description"
}
```

### Add File Associations
Edit `build/installer.nsh` and add:
```nsis
; Associate .yourfile extension
WriteRegStr HKCR ".yourfile" "" "YourApp.File"
WriteRegStr HKCR "YourApp.File\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
```

## Troubleshooting

### "Icon not found" Error
1. Create `assets/icon.ico` (see Step 2 above)
2. Or temporarily remove `"icon": "assets/icon.ico"` from package.json

### "electron-builder not found"
```bash
npm install electron-builder --save-dev
```

### Build Fails on Windows
Make sure you have:
- Windows SDK (for code signing, optional)
- Visual Studio Build Tools (optional)

### Output is Large
This is normal! Electron apps include:
- Chromium (~100MB)
- Node.js runtime
- App files

Typical size: 150-250MB

## Distribution

### Zip and Share
```bash
cd dist
zip -r "Ceres-AI-Agent-v1.0.0.zip" "Ceres AI Agent"
```

### Upload to GitHub Releases
1. Create new release on GitHub
2. Upload:
   - `Ceres AI Agent Setup.exe` (Windows installer)
   - `Ceres AI Agent.dmg` (macOS)
   - `Ceres AI Agent.AppImage` (Linux)

### Auto-Updater Setup
To enable auto-updates, add to package.json:
```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "your-username",
      "repo": "ceres-ai-agent"
    }
  }
}
```

## Build Scripts Explained

| Command | What it does |
|---------|-------------|
| `npm start` | Run app in development |
| `npm run build` | Build for all platforms |
| `npm run build:win` | Build Windows installer (.exe) |
| `npm run build:mac` | Build macOS (.dmg) |
| `npm run build:linux` | Build Linux (.AppImage) |
| `npm run dist` | Build Windows distribution |

## Need Help?

1. Check `build/ICON_README.txt` for icon creation help
2. See Electron Builder docs: https://www.electron.build
3. Open an issue on GitHub

---

**Happy Building!** 🚀
