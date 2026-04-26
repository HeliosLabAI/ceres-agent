const fs = require('fs').promises;
const path = require('path');
const toIco = require('to-ico');

async function convert() {
    try {
        const input = path.join(__dirname, '..', 'assets', 'icon-256.png');
        const output = path.join(__dirname, '..', 'assets', 'icon.ico');
        
        // Read the PNG file
        const inputBuf = await fs.readFile(input);
        
        // Convert to ICO (with multiple sizes)
        const result = await toIco([inputBuf], { resize: true, sizes: [16, 32, 48, 64, 128, 256] });
        
        // Write the ICO file
        await fs.writeFile(output, result);
        
        console.log('✓ Created icon.ico from icon-256.png');
        console.log('  Sizes: 16, 32, 48, 64, 128, 256 pixels');
    } catch (e) {
        console.error('Error:', e.message);
        console.log('\nAlternative: Use online converter:');
        console.log('  https://convertio.co/png-ico/');
        process.exit(1);
    }
}

convert();
