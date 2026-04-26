const fs = require('fs');
const path = require('path');

async function convert() {
    try {
        // Try png-to-ico
        const pngToIco = require('png-to-ico');
        const input = path.join(__dirname, '..', 'assets', 'icon-256.png');
        
        const result = await pngToIco(input);
        const output = path.join(__dirname, '..', 'assets', 'icon.ico');
        fs.writeFileSync(output, result);
        console.log('✓ Created icon.ico from icon-256.png');
    } catch (e) {
        console.error('Error:', e.message);
        console.log('\nAlternative: Use online converter:');
        console.log('  https://convertio.co/png-ico/');
        process.exit(1);
    }
}

convert();
