import path from 'path';
import sharp from 'sharp';

/**
 * Builds the Apple Wallet pass icon (icon.png / @2x / @3x). Apple shows it in lock-screen
 * notifications and suggestions, so it must read at 29pt: the brand's white shaker on black with a
 * red base bar. Uses the same shaker artwork as the stamps. Run with
 * `npx tsx scripts/generate-pass-icon.ts`; outputs are committed.
 */

const OUT = path.resolve(__dirname, '../assets/apple-pass');
const SHAKER = path.join(OUT, 'shaker-filled.png');
const BLACK = '#0b0b0c';
const RED = '#e21c24';

async function icon(size: number): Promise<Buffer> {
  const shaker = await sharp(SHAKER).resize({ height: Math.round(size * 0.72) }).png().toBuffer();
  const { width } = await sharp(shaker).metadata();
  const bar = Math.max(2, Math.round(size * 0.08));
  const barSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><rect y="${size - bar}" width="${size}" height="${bar}" fill="${RED}"/></svg>`;
  return sharp({ create: { width: size, height: size, channels: 3, background: BLACK } })
    .composite([
      { input: shaker, left: Math.round((size - (width ?? 0)) / 2), top: Math.round(size * 0.1) },
      { input: Buffer.from(barSvg), left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}

async function main() {
  for (const [file, size] of [['icon.png', 29], ['icon@2x.png', 58], ['icon@3x.png', 87]] as const) {
    await sharp(await icon(size)).toFile(path.join(OUT, file));
    console.log('wrote', file, size + 'x' + size);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
