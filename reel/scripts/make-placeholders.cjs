#!/usr/bin/env node
/**
 * Generates the 4 placeholder stand-in images (1080x1350, solid colour +
 * a simple label stripe) so the Remotion project runs end-to-end before
 * the real supplied designs are dropped into public/assets. No external
 * deps — hand-rolls a minimal PNG (RGB, filter 0, zlib deflate) using only
 * Node's built-in zlib.
 *
 * Replace the output files with the real 4:5 exports (same filenames) and
 * these placeholders are simply overwritten.
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const WIDTH = 1080;
const HEIGHT = 1350;

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function makePng(filePath, bgHex, stripeHex, label) {
  const [br, bg, bb] = hexToRgb(bgHex);
  const [sr, sg, sb] = hexToRgb(stripeHex);

  const raw = Buffer.alloc((WIDTH * 3 + 1) * HEIGHT);
  let offset = 0;
  const stripeY0 = Math.floor(HEIGHT * 0.46);
  const stripeY1 = Math.floor(HEIGHT * 0.54);

  for (let y = 0; y < HEIGHT; y++) {
    raw[offset++] = 0; // filter type: none
    const inStripe = y >= stripeY0 && y < stripeY1;
    for (let x = 0; x < WIDTH; x++) {
      if (inStripe) {
        raw[offset++] = sr;
        raw[offset++] = sg;
        raw[offset++] = sb;
      } else {
        raw[offset++] = br;
        raw[offset++] = bg;
        raw[offset++] = bb;
      }
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(WIDTH, 0);
  ihdr.writeUInt32BE(HEIGHT, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(raw, { level: 6 });

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);

  fs.writeFileSync(filePath, png);
  console.log(`Wrote ${filePath} (${label})`);
}

const outDir = path.join(__dirname, "..", "public", "assets");
fs.mkdirSync(outDir, { recursive: true });

makePng(path.join(outDir, "scene1-another-5-star.png"), "#2b2f36", "#d4a939", "Scene 1 placeholder — ANOTHER 5 STAR EXPERIENCE");
makePng(path.join(outDir, "scene2-review-card.png"), "#111318", "#ffffff", "Scene 2 placeholder — review card");
makePng(path.join(outDir, "scene3-modern-fleet.png"), "#1c1f24", "#3a4048", "Scene 3 placeholder — MODERN FLEET");
makePng(path.join(outDir, "scene4-thank-you.png"), "#0b0d10", "#d4a939", "Scene 4 placeholder — THANK YOU");
