const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(width, height, getPixel) {
    // getPixel(x, y) => [r, g, b, a]
    const rowSize = width * 4 + 1;
    const rawData = Buffer.alloc(rowSize * height);

    for (let y = 0; y < height; y++) {
        const rowOffset = y * rowSize;
        rawData[rowOffset] = 0; // Filter type 0 (None)
        for (let x = 0; x < width; x++) {
            const [r, g, b, a] = getPixel(x, y);
            const pxOffset = rowOffset + 1 + x * 4;
            rawData[pxOffset] = r;
            rawData[pxOffset + 1] = g;
            rawData[pxOffset + 2] = b;
            rawData[pxOffset + 3] = a;
        }
    }

    const compressed = zlib.deflateSync(rawData);

    // PNG Signature
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    // IHDR
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(width, 0);
    ihdrData.writeUInt32BE(height, 4);
    ihdrData[8] = 8; // Bit depth
    ihdrData[9] = 6; // Color type: RGBA
    ihdrData[10] = 0; // Compression
    ihdrData[11] = 0; // Filter
    ihdrData[12] = 0; // Interlace
    const ihdr = createChunk('IHDR', ihdrData);

    // IDAT
    const idat = createChunk('IDAT', compressed);

    // IEND
    const iend = createChunk('IEND', Buffer.alloc(0));

    return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type, data) {
    const len = data.length;
    const chunk = Buffer.alloc(8 + len + 4);
    chunk.writeUInt32BE(len, 0);
    chunk.write(type, 4, 4, 'ascii');
    data.copy(chunk, 8);
    const crc = crc32(chunk.slice(4, 8 + len));
    chunk.writeUInt32BE(crc, 8 + len);
    return chunk;
}

// CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[n] = c;
}

function crc32(buf) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Generate 128x128 microStudio Logo
// Design: Dark background with rounded square, teal/cyan glowing frame (#00d2be),
// microStudio arcade monitor with pixel eyes and gamepad buttons.
const size = 128;
const pngBuf = createPNG(size, size, (x, y) => {
    // Normalize coordinates -1 to 1
    const nx = (x - size / 2) / (size / 2);
    const ny = (y - size / 2) / (size / 2);

    // Outer rounded box (radius ~ 0.85, corner radius 0.25)
    const bx = Math.abs(nx) - (0.85 - 0.25);
    const by = Math.abs(ny) - (0.85 - 0.25);
    const dist = Math.sqrt(Math.max(0, bx) ** 2 + Math.max(0, by) ** 2);
    const inBox = (bx <= 0 && by <= 0) || dist <= 0.25;

    if (!inBox) {
        return [0, 0, 0, 0]; // Transparent outside
    }

    // Border thickness ~ 0.08
    const bxInner = Math.abs(nx) - (0.75 - 0.2);
    const byInner = Math.abs(ny) - (0.75 - 0.2);
    const distInner = Math.sqrt(Math.max(0, bxInner) ** 2 + Math.max(0, byInner) ** 2);
    const inInnerBox = (bxInner <= 0 && byInner <= 0) || distInner <= 0.2;

    // Outer Border (Cyan / Emerald gradient)
    if (!inInnerBox) {
        const grad = (ny + 1) / 2;
        return [
            Math.round(20 * (1 - grad) + 0 * grad),
            Math.round(210 * (1 - grad) + 180 * grad),
            Math.round(190 * (1 - grad) + 240 * grad),
            255
        ];
    }

    // Screen area (dark slate blue #182230)
    const isScreen = Math.abs(nx) <= 0.65 && ny >= -0.65 && ny <= 0.25;
    const isBottomPanel = Math.abs(nx) <= 0.65 && ny > 0.25 && ny <= 0.65;

    if (isScreen) {
        // Screen background (deep slate #111a24)
        // Draw pixel eyes and face!
        // Left eye (around nx = -0.3, ny = -0.2)
        const inLeftEye = Math.abs(nx - (-0.28)) <= 0.10 && Math.abs(ny - (-0.22)) <= 0.12;
        // Right eye (around nx = 0.28, ny = -0.2)
        const inRightEye = Math.abs(nx - 0.28) <= 0.10 && Math.abs(ny - (-0.22)) <= 0.12;
        // Smile arc / line
        const inSmile = Math.abs(ny - 0.05) <= 0.04 && Math.abs(nx) <= 0.22;

        if (inLeftEye || inRightEye || inSmile) {
            // Bright Glowing Cyan
            return [60, 240, 220, 255];
        }

        // Screen scanline subtle effect
        const scan = (y % 4 === 0) ? 0.9 : 1.0;
        return [Math.round(18 * scan), Math.round(28 * scan), Math.round(40 * scan), 255];
    }

    if (isBottomPanel) {
        // Gamepad controls area on bottom
        // D-Pad on left (around nx = -0.35, ny = 0.45)
        const dpadH = Math.abs(nx - (-0.35)) <= 0.14 && Math.abs(ny - 0.45) <= 0.05;
        const dpadV = Math.abs(nx - (-0.35)) <= 0.05 && Math.abs(ny - 0.45) <= 0.14;
        if (dpadH || dpadV) {
            return [100, 120, 145, 255]; // D-Pad grey
        }

        // Action Buttons on right:
        // Button A (red / coral #ff5252 at nx = 0.42, ny = 0.38)
        const distBtnA = Math.sqrt((nx - 0.42) ** 2 + (ny - 0.38) ** 2);
        if (distBtnA <= 0.08) {
            return [255, 82, 82, 255];
        }
        // Button B (yellow / gold #ffd740 at nx = 0.25, ny = 0.52)
        const distBtnB = Math.sqrt((nx - 0.25) ** 2 + (ny - 0.52) ** 2);
        if (distBtnB <= 0.08) {
            return [255, 215, 64, 255];
        }

        return [28, 38, 52, 255]; // Panel background
    }

    // Chassis body #202b3b
    return [32, 43, 59, 255];
});

const outPath = path.join(__dirname, 'vscode-microstudio', 'media', 'icon.png');
fs.writeFileSync(outPath, pngBuf);
console.log('Successfully generated:', outPath, 'size:', pngBuf.length, 'bytes');
