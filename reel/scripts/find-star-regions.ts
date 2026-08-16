/**
 * Calibration helper: run this AFTER the real 4 source images are dropped
 * into public/assets (see README.md for exact filenames). It scans each
 * image for the gold star-icon colour within an expanded search window
 * around the current estimate in src/constants.ts, and prints a tighter
 * bounding box (as a fraction of the 1080x1350 canvas) you can paste back
 * into STAR_REGIONS.
 *
 * Usage: npm run calibrate
 */
import fs from "fs";
import path from "path";
import { PNG } from "pngjs";
import jpeg from "jpeg-js";
import { ASSETS, HEIGHT, STAR_REGIONS, WIDTH } from "../src/constants";

type Decoded = { data: Buffer; width: number; height: number };

function decode(filePath: string): Decoded {
  const buf = fs.readFileSync(filePath);
  if (filePath.toLowerCase().endsWith(".png")) {
    const png = PNG.sync.read(buf);
    return { data: png.data, width: png.width, height: png.height };
  }
  const img = jpeg.decode(buf, { useTArray: true });
  return { data: Buffer.from(img.data), width: img.width, height: img.height };
}

// Gold star colour range (typical brand-gold star icon). Widen/narrow if
// the calibration comes back empty or too noisy for your exact asset.
function isGold(r: number, g: number, b: number) {
  return r > 170 && r < 255 && g > 120 && g < 220 && b < 130 && r - b > 60 && g - b > 30;
}

function calibrate(label: string, relPath: string, region: { x: number; y: number; w: number; h: number }) {
  const filePath = path.join(__dirname, "..", "public", relPath);
  if (!fs.existsSync(filePath)) {
    console.log(`[skip] ${label}: ${relPath} not found yet.`);
    return;
  }
  const img = decode(filePath);
  const sx = img.width / WIDTH;
  const sy = img.height / HEIGHT;

  // Search a generously expanded window around the current estimate.
  const margin = 0.5;
  const x0 = Math.max(0, Math.floor((region.x - region.w * margin) * WIDTH * sx));
  const x1 = Math.min(img.width, Math.ceil((region.x + region.w * (1 + margin)) * WIDTH * sx));
  const y0 = Math.max(0, Math.floor((region.y - region.h * margin) * HEIGHT * sy));
  const y1 = Math.min(img.height, Math.ceil((region.y + region.h * (1 + margin)) * HEIGHT * sy));

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let hits = 0;

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const idx = (y * img.width + x) * 4;
      const r = img.data[idx];
      const g = img.data[idx + 1];
      const b = img.data[idx + 2];
      if (isGold(r, g, b)) {
        hits++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (hits < 20) {
    console.log(`[warn] ${label}: only found ${hits} gold-ish pixels — widen the search margin or the isGold() thresholds.`);
    return;
  }

  const fx = minX / sx / WIDTH;
  const fy = minY / sy / HEIGHT;
  const fw = (maxX - minX) / sx / WIDTH;
  const fh = (maxY - minY) / sy / HEIGHT;

  console.log(
    `${label}: { x: ${fx.toFixed(3)}, y: ${fy.toFixed(3)}, w: ${fw.toFixed(3)}, h: ${fh.toFixed(3)} }  (${hits} px matched)`
  );
}

calibrate("scene1", ASSETS.scene1, STAR_REGIONS.scene1);
calibrate("scene2", ASSETS.scene2, STAR_REGIONS.scene2);
calibrate("scene4", ASSETS.scene4, STAR_REGIONS.scene4);
