import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

/**
 * Required/recommended PNG assets for a storeCard-style .pkpass. The real brand assets (see
 * scripts/generate-brand-assets.ts, derived from scraps/pdf-page-*.png) live in assets/apple-pass/
 * and are checked into git so every deploy ships them — unlike secrets/, which never leaves this
 * machine. If a file is somehow missing there, a plain placeholder is generated as a fallback so
 * the pass still builds instead of throwing.
 */

const ASSETS_DIR = path.resolve(process.cwd(), 'assets/apple-pass');

const BLACK: [number, number, number] = [11, 11, 12]; // #0b0b0c
const RED: [number, number, number] = [226, 28, 36]; // #e21c24
const GOLD: [number, number, number] = [205, 168, 106]; // #cda86a

function solidPng(width: number, height: number, rgb: [number, number, number], accentBottomRgb?: [number, number, number]): Buffer {
  const png = new PNG({ width, height });
  const accentHeight = accentBottomRgb ? Math.max(1, Math.round(height * 0.12)) : 0;
  for (let y = 0; y < height; y++) {
    const useAccent = accentBottomRgb && y >= height - accentHeight;
    const [r, g, b] = useAccent ? accentBottomRgb! : rgb;
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

interface AssetSpec {
  filename: string;
  width: number;
  height: number;
  rgb: [number, number, number];
  accent?: [number, number, number];
}

const SPECS: AssetSpec[] = [
  // Required app icon (shown in notifications / settings)
  { filename: 'icon.png', width: 29, height: 29, rgb: RED },
  { filename: 'icon@2x.png', width: 58, height: 58, rgb: RED },
  { filename: 'icon@3x.png', width: 87, height: 87, rgb: RED },
  // Logo shown in the pass header
  { filename: 'logo.png', width: 160, height: 50, rgb: BLACK, accent: RED },
  { filename: 'logo@2x.png', width: 320, height: 100, rgb: BLACK, accent: RED },
  { filename: 'logo@3x.png', width: 480, height: 150, rgb: BLACK, accent: RED },
  // Strip image (storeCard hero area)
  { filename: 'strip.png', width: 312, height: 84, rgb: BLACK, accent: GOLD },
  { filename: 'strip@2x.png', width: 624, height: 168, rgb: BLACK, accent: GOLD },
  { filename: 'strip@3x.png', width: 936, height: 252, rgb: BLACK, accent: GOLD },
];

export function ensureAppleAssetsGenerated(): void {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
  for (const spec of SPECS) {
    const filePath = path.join(ASSETS_DIR, spec.filename);
    if (fs.existsSync(filePath)) continue;
    fs.writeFileSync(filePath, solidPng(spec.width, spec.height, spec.rgb, spec.accent));
  }
}

export function loadAppleAssetFiles(): Record<string, Buffer> {
  ensureAppleAssetsGenerated();
  const files: Record<string, Buffer> = {};
  for (const spec of SPECS) {
    files[spec.filename] = fs.readFileSync(path.join(ASSETS_DIR, spec.filename));
  }
  return files;
}

export const APPLE_ASSETS_DIR = ASSETS_DIR;
