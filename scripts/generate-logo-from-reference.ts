import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

/**
 * Cuts the real "UFC GYM | FUEL" logo out of the approved card design
 * (assets/apple-pass/source/card-reference.png) and makes its black background transparent
 * (alpha = brightest channel, like the shaker icons), so the web card and the Wallet pass show the
 * exact same logo as the design. Run with `npx tsx scripts/generate-logo-from-reference.ts`.
 */

const SRC = path.resolve(__dirname, '../assets/apple-pass/source/card-reference.png');
const OUT = path.resolve(__dirname, '../assets/apple-pass');
const WEB = path.resolve(__dirname, '../public/card');

// Logo area inside the 1024x1536 reference (measured on the design).
const REGION = { left: 80, top: 176, width: 530, height: 96 };
const FLOOR = 38; // anything darker than this is background texture, not logo

async function main() {
  const { data, info } = await sharp(SRC).extract(REGION).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.from(data);
  for (let i = 0; i < data.length; i += 4) {
    const max = Math.max(data[i], data[i + 1], data[i + 2]);
    const alpha = Math.max(0, Math.min(255, Math.round(((max - FLOOR) * 255) / (255 - FLOOR))));
    const k = max > 0 ? 255 / max : 0;
    out[i] = Math.min(255, Math.round(data[i] * k));
    out[i + 1] = Math.min(255, Math.round(data[i + 1] * k));
    out[i + 2] = Math.min(255, Math.round(data[i + 2] * k));
    out[i + 3] = alpha;
  }
  const raw = { raw: { width: info.width, height: info.height, channels: 4 as const } };
  const trimmed = await sharp(out, raw).trim({ threshold: 8 }).extend({ top: 4, bottom: 4, left: 4, right: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const meta = await sharp(trimmed).metadata();
  console.log('logo trimmed', meta.width, 'x', meta.height);

  // Wallet pass logo (Apple scales it to fit 160x50 pt): 1x / 2x / 3x.
  for (const [file, w] of [['logo.png', 160], ['logo@2x.png', 320], ['logo@3x.png', 480]] as const) {
    await sharp(trimmed).resize({ width: w }).png().toFile(path.join(OUT, file));
  }
  // Web card: 2x of the largest CSS size we show (~280px).
  fs.mkdirSync(WEB, { recursive: true });
  await sharp(trimmed).resize({ width: 640, kernel: 'lanczos3' }).png().toFile(path.join(WEB, 'logo.png'));
  console.log('wrote logo for pass (1x/2x/3x) and web');
}

main().catch((e) => { console.error(e); process.exit(1); });
