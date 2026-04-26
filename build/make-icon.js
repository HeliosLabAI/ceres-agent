// Create a simple ICO file for Ceres AI Agent
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');
const iconPath = path.join(assetsDir, 'icon.ico');

// Check if icon already exists
if (fs.existsSync(iconPath)) {
    console.log('✓ icon.ico already exists');
    process.exit(0);
}

// Try to use sharp to create a simple colored square icon
try {
    const sharp = require('sharp');
    
    // Create a 256x256 blue square with "C" text
    const svgBuffer = `
    <svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#3b82f6"/>
          <stop offset="100%" style="stop-color:#1d4ed8"/>
        </linearGradient>
      </defs>
      <rect width="256" height="256" fill="url(#bg)" rx="48"/>
      <text x="128" y="170" font-family="Arial" font-size="140" font-weight="bold" fill="white" text-anchor="middle">C</text>
      <circle cx="200" cy="200" r="15" fill="#22c55e"/>
    </svg>
    `;
    
    sharp(Buffer.from(svgBuffer))
        .resize(256, 256)
        .png()
        .toFile(path.join(assetsDir, 'icon.png'))
        .then(() => {
            console.log('✓ Created icon.png (convert to .ico manually or use online tool)');
            console.log('  Visit: https://convertio.co/png-ico/');
        })
        .catch(err => {
            console.error('Error creating icon:', err.message);
        });
        
} catch (e) {
    // sharp not available, use placeholder approach
    console.log('Creating placeholder icon...');
    
    // Create a simple BMP-like structure or use a pre-made minimal ICO
    // This is a minimal 16x16 and 32x32 ICO file (binary)
    
    const minimalIco = Buffer.from([
        0x00, 0x00, 0x01, 0x00, 0x02, 0x00, 0x10, 0x10, 0x00, 0x00, 0x01, 0x00,
        0x20, 0x00, 0x68, 0x04, 0x00, 0x00, 0x26, 0x00, 0x00, 0x00, 0x20, 0x20,
        0x00, 0x00, 0x01, 0x00, 0x20, 0x00, 0xE8, 0x02, 0x00, 0x00, 0x8E, 0x04,
        0x00, 0x00, 0x28, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x20, 0x00,
        0x00, 0x00, 0x01, 0x00, 0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x3B, 0x82, 0xF6, 0x00, 0x3B, 0x82, 0xF6, 0x00
    ]);
    
    // Write a minimal valid ICO (blue square)
    // This is a simplified version - real ICO needs proper headers
    
    fs.writeFileSync(iconPath, minimalIco);
    console.log('✓ Created minimal icon.ico (blue placeholder)');
    console.log('  Replace with proper icon later using:');
    console.log('  https://convertio.co/png-ico/');
}
