import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

/**
 * Generates the Apple Wallet pass image assets (strip, 1x/2x/3x; the logo comes from
 * generate-logo-from-reference.ts and the icon from generate-pass-icon.ts) from hand-written
 * SVG, based on the brand reference in ../../scraps/pdf-page-1.png (black bg, red #e21c24,
 * gold #cda86a, "UFC GYM | FUEL" wordmark). Output goes to assets/apple-pass/ — tracked in git,
 * unlike secrets/ — so it ships with every deploy instead of falling back to placeholders.
 */

const OUT_DIR = path.resolve(__dirname, '../assets/apple-pass');
fs.mkdirSync(OUT_DIR, { recursive: true });

const BLACK = '#0b0b0c';
const GOLD = '#cda86a';

function stripSvg(width: number, height: number): string {
  const stripes: string[] = [];
  const gap = height * 0.55;
  for (let x = -height; x < width + height; x += gap) {
    stripes.push(
      `<line x1="${x}" y1="${height}" x2="${x + height}" y2="0" stroke="#1c1c1e" stroke-width="${height * 0.05}"/>`,
    );
  }
  const accentH = height * 0.09;
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="${BLACK}"/>
    <g>${stripes.join('')}</g>
    <rect x="0" y="${height - accentH}" width="${width}" height="${accentH}" fill="${GOLD}"/>
  </svg>`;
}

interface Spec {
  filename: string;
  width: number;
  height: number;
  svg: (w: number, h: number) => string;
}

const SPECS: Spec[] = [
  { filename: 'strip.png', width: 312, height: 84, svg: stripSvg },
  { filename: 'strip@2x.png', width: 624, height: 168, svg: stripSvg },
  { filename: 'strip@3x.png', width: 936, height: 252, svg: stripSvg },
];

async function main() {
  for (const spec of SPECS) {
    const svg = spec.svg(spec.width, spec.height);
    const buf = await sharp(Buffer.from(svg)).png().toBuffer();
    fs.writeFileSync(path.join(OUT_DIR, spec.filename), buf);
    console.log('wrote', spec.filename, buf.length, 'bytes');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
