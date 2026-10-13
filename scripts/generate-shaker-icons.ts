import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

/**
 * Builds the stamp icons from the brand's real shaker artwork
 * (assets/apple-pass/source/shaker-reference.png: white/red line art on solid black):
 *  - the black background becomes transparent (alpha = brightest channel), keeping the art's colors
 *  - shaker-filled.png: the art as-is (earned stamp)
 *  - shaker-empty.png: desaturated + dimmed (pending stamp)
 * Run once with `npx tsx scripts/generate-shaker-icons.ts`; outputs are committed.
 */

const SRC = path.resolve(__dirname, '../assets/apple-pass/source/shaker-reference.png');
const OUT = path.resolve(__dirname, '../assets/apple-pass');
const ICON_HEIGHT = 420;

async function main() {
  const trimmed = await sharp(SRC).trim({ background: '#000000', threshold: 12 }).toBuffer();
  const resized = await sharp(trimmed).resize({ height: ICON_HEIGHT }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = resized;

  const filled = Buffer.from(data);
  const empty = Buffer.from(data);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const alpha = Math.max(r, g, b);
    // Un-premultiply against black so edges keep their true color instead of darkening.
    const scale = alpha > 0 ? 255 / alpha : 0;
    const rr = Math.min(255, Math.round(r * scale));
    const gg = Math.min(255, Math.round(g * scale));
    const bb = Math.min(255, Math.round(b * scale));

    filled[i] = rr;
    filled[i + 1] = gg;
    filled[i + 2] = bb;
    filled[i + 3] = alpha;

    const gray = Math.round(0.3 * rr + 0.59 * gg + 0.11 * bb);
    empty[i] = gray;
    empty[i + 1] = gray;
    empty[i + 2] = gray;
    empty[i + 3] = Math.round(alpha * 0.3);
  }

  // Gold variants for the reward slot: brightness of the art mapped onto a gold ramp, so the
  // white outline becomes gold and the red wordmark becomes a darker gold (still readable).
  const gold = Buffer.from(data);
  const goldDim = Buffer.from(data);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const alpha = Math.max(r, g, b);
    const scale = alpha > 0 ? 255 / alpha : 0;
    const lum = (0.3 * Math.min(255, r * scale) + 0.59 * Math.min(255, g * scale) + 0.11 * Math.min(255, b * scale)) / 255;
    const tone = 0.5 + 0.5 * lum;
    for (const buf of [gold, goldDim]) {
      buf[i] = Math.round(236 * tone);
      buf[i + 1] = Math.round(198 * tone);
      buf[i + 2] = Math.round(112 * tone);
    }
    gold[i + 3] = alpha;
    goldDim[i + 3] = Math.round(alpha * 0.8);
  }

  const raw = { raw: { width: info.width, height: info.height, channels: 4 as const } };
  await sharp(filled, raw).png().toFile(path.join(OUT, 'shaker-filled.png'));
  await sharp(empty, raw).png().toFile(path.join(OUT, 'shaker-empty.png'));
  await sharp(gold, raw).png().toFile(path.join(OUT, 'shaker-gold.png'));
  await sharp(goldDim, raw).png().toFile(path.join(OUT, 'shaker-gold-dim.png'));
  console.log('wrote shaker-filled / empty / gold / gold-dim', info.width, 'x', info.height);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
