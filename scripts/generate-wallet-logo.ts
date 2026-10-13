import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

/**
 * Builds public/wallet-logo.png — the square program logo Google Wallet shows on Android — from the
 * brand shaker artwork (assets/apple-pass/shaker-filled.png) centered on the brand black.
 * Google crops it to a circle, so the shaker is kept well inside the safe area.
 * Run once with `npx tsx scripts/generate-wallet-logo.ts`; the output is committed.
 */

const SIZE = 660;
const OUT = path.resolve(__dirname, '../public/wallet-logo.png');

async function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const shaker = await sharp(path.resolve(__dirname, '../assets/apple-pass/shaker-filled.png'))
    .resize({ height: Math.round(SIZE * 0.62) })
    .toBuffer();
  await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: '#0b0b0c' } })
    .composite([{ input: shaker, gravity: 'center' }])
    .png()
    .toFile(OUT);
  console.log('wrote public/wallet-logo.png');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
