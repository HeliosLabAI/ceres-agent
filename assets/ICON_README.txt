CERES AI AGENT - ICON GENERATION
================================

To create icon.ico for Windows installer:

METHOD 1 - Online (Easiest):
1. Open assets/icon.svg in browser
2. Screenshot the icon or save as PNG
3. Go to: https://cloudconvert.com/png-to-ico
4. Upload and convert to ICO with sizes: 16,32,48,64,128,256

METHOD 2 - ImageMagick:
  convert assets/icon.svg assets/icon.ico

METHOD 3 - Node.js (if sharp is installed):
  npm install sharp
  node build/create-icon.js --sharp

METHOD 4 - GIMP:
1. Open icon.svg in GIMP
2. Export as icon.ico
3. Select all sizes (16,32,48,64,128,256)

For macOS icon.icns:
  Use: https://iconverticons.com/online/

Current SVG: assets/icon.svg
Output: assets/icon.ico (Windows), assets/icon.icns (macOS)
