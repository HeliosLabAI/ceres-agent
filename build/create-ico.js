const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

async function createIcon() {
    const size = 256;
    const image = new Jimp(size, size);
    
    // Create blue gradient background
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            // Blue gradient: from lighter at top to darker at bottom
            const ratio = y / size;
            const r = Math.floor(59 * (1 - ratio * 0.3));
            const g = Math.floor(130 * (1 - ratio * 0.3));
            const b = Math.floor(246 * (1 - ratio * 0.2));
            image.setPixelColor(Jimp.rgbaToInt(r, g, b, 255), x, y);
        }
    }
    
    // Add rounded corners (48px radius)
    const radius = 48;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            // Check if in corner regions
            const inTopLeft = x < radius && y < radius;
            const inTopRight = x >= size - radius && y < radius;
            const inBottomLeft = x < radius && y >= size - radius;
            const inBottomRight = x >= size - radius && y >= size - radius;
            
            if (inTopLeft || inTopRight || inBottomLeft || inBottomRight) {
                // Calculate distance from corner center
                let cx, cy;
                if (inTopLeft) { cx = radius; cy = radius; }
                else if (inTopRight) { cx = size - radius; cy = radius; }
                else if (inBottomLeft) { cx = radius; cy = size - radius; }
                else { cx = size - radius; cy = size - radius; }
                
                const dx = x - cx;
                const dy = y - cy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist > radius) {
                    image.setPixelColor(Jimp.rgbaToInt(0, 0, 0, 0), x, y);
                }
            }
        }
    }
    
    // Add "C" text
    const font = await Jimp.loadFont(Jimp.FONT_SANS_128_WHITE);
    image.print(font, 0, 60, {
        text: 'C',
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
        alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
    }, size, size);
    
    // Add green dot
    const dotRadius = 15;
    const dotX = 200;
    const dotY = 200;
    for (let y = dotY - dotRadius; y <= dotY + dotRadius; y++) {
        for (let x = dotX - dotRadius; x <= dotX + dotRadius; x++) {
            const dx = x - dotX;
            const dy = y - dotY;
            if (dx * dx + dy * dy <= dotRadius * dotRadius) {
                image.setPixelColor(Jimp.rgbaToInt(34, 197, 94, 255), x, y);
            }
        }
    }
    
    // Save as PNG first
    const pngPath = path.join(__dirname, '..', 'assets', 'icon-256.png');
    await image.writeAsync(pngPath);
    console.log('✓ Created icon-256.png');
    
    // For ICO, we need multiple sizes. Jimp doesn't support ICO directly,
    // so we'll save multiple PNGs and provide instructions for conversion
    const sizes = [16, 32, 48, 64, 128, 256];
    for (const s of sizes) {
        const resized = image.clone().resize(s, s);
        await resized.writeAsync(path.join(__dirname, '..', 'assets', `icon-${s}.png`));
        console.log(`✓ Created icon-${s}.png`);
    }
    
    // Create a simple ICO using toICO library if available
    try {
        const toIco = require('to-ico');
        const files = sizes.map(s => path.join(__dirname, '..', 'assets', `icon-${s}.png`));
        const bufs = await Promise.all(files.map(f => fs.promises.readFile(f)));
        const ico = await toIco(bufs);
        await fs.promises.writeFile(path.join(__dirname, '..', 'assets', 'icon.ico'), ico);
        console.log('✓ Created icon.ico');
    } catch (e) {
        console.log('\nNote: Install "to-ico" for automatic ICO creation:');
        console.log('  npm install to-ico');
        console.log('\nOr use online converter:');
        console.log('  https://convertio.co/png-ico/');
        console.log('\nUpload icon-256.png and download icon.ico');
    }
}

createIcon().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
