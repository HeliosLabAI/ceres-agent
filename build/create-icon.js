// Create icon script for Ceres AI Agent
const fs = require('fs');
const path = require('path');

const sizes = [16, 32, 48, 64, 128, 256];

async function createIcon() {
  console.log('Creating Ceres AI Agent icon...\n');
  
  const svgPath = path.join(__dirname, '..', 'assets', 'icon.svg');
  const assetsDir = path.join(__dirname, '..', 'assets');
  
  if (!fs.existsSync(svgPath)) {
    console.error('SVG icon not found at:', svgPath);
    return;
  }
  
  // Create README for icon generation
  const readmePath = path.join(assetsDir, 'ICON_README.txt');
  fs.writeFileSync(readmePath, `CERES AI AGENT - ICON GENERATION
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
`);
  
  console.log('✓ Created icon.svg');
  console.log('✓ Created ICON_README.txt');
  console.log('\nNEXT STEPS:');
  console.log('  1. Convert icon.svg to icon.ico (see ICON_README.txt)');
  console.log('  2. Or use online converter: https://cloudconvert.com/png-to-ico');
  console.log('  3. Then run: npm run build:win\n');
  
  // Try to use sharp if available
  try {
    const sharp = require('sharp');
    console.log('Sharp found! Generating PNG sizes...');
    
    const svgBuffer = fs.readFileSync(svgPath);
    
    for (const size of sizes) {
      const outputPath = path.join(assetsDir, `icon-${size}.png`);
      await sharp(svgBuffer, { density: 300 })
        .resize(size, size)
        .png()
        .toFile(outputPath);
      console.log(`  ✓ Created icon-${size}.png`);
    }
    
    console.log('\n✓ All PNG sizes created!');
    console.log('  Combine these into icon.ico using an online converter.');
    
  } catch (e) {
    console.log('\nNote: Install "sharp" for automatic PNG generation:');
    console.log('  npm install sharp');
  }
}

createIcon().catch(console.error);
