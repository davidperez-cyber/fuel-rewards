import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { textGroup } from '../src/lib/apple/textPath';

/**
 * Generates the Apple Wallet pass image assets (icon/logo/strip, 1x/2x/3x) from hand-written
 * SVG, based on the brand reference in ../../scraps/pdf-page-1.png (black bg, red #e21c24,
 * gold #cda86a, "UFC GYM | FUEL" wordmark). Output goes to assets/apple-pass/ — tracked in git,
 * unlike secrets/ — so it ships with every deploy instead of falling back to placeholders.
 */

const OUT_DIR = path.resolve(__dirname, '../assets/apple-pass');
fs.mkdirSync(OUT_DIR, { recursive: true });

const BLACK = '#0b0b0c';
const RED = '#e21c24';
const GOLD = '#cda86a';
const WHITE = '#ffffff';

function iconSvg(size: number): string {
  const r = size * 0.5;
  const ring = size * 0.36;
  const dot = size * 0.13;
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="${BLACK}"/>
    <circle cx="${r}" cy="${r}" r="${ring}" fill="none" stroke="${GOLD}" stroke-width="${size * 0.09}"/>
    <circle cx="${r}" cy="${r}" r="${dot}" fill="${RED}"/>
  </svg>`;
}

function logoSvg(width: number, height: number): string {
  const fontSize = height * 0.4;
  const y = height * 0.68;
  // "UFC" red, "GYM" white with a red underline, divider, "FUEL" red — as in the brand reference.
  const ufc = textGroup('UFC', fontSize, 0, y, RED);
  const gymX = ufc.width + fontSize * 0.22;
  const gym = textGroup('GYM', fontSize, gymX, y, WHITE);
  const dividerX = gymX + gym.width + width * 0.035;
  const fuel = textGroup('FUEL', fontSize, dividerX + width * 0.045, y, RED);
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    ${ufc.svg}
    ${gym.svg}
    <rect x="${gymX}" y="${y + height * 0.07}" width="${gym.width}" height="${Math.max(1, height * 0.03)}" fill="${RED}"/>
    <line x1="${dividerX}" y1="${height * 0.2}" x2="${dividerX}" y2="${height * 0.8}" stroke="#3a3a3a" stroke-width="${height * 0.025}"/>
    ${fuel.svg}
  </svg>`;
}

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
  { filename: 'icon.png', width: 29, height: 29, svg: (w) => iconSvg(w) },
  { filename: 'icon@2x.png', width: 58, height: 58, svg: (w) => iconSvg(w) },
  { filename: 'icon@3x.png', width: 87, height: 87, svg: (w) => iconSvg(w) },

  { filename: 'logo.png', width: 160, height: 50, svg: logoSvg },
  { filename: 'logo@2x.png', width: 320, height: 100, svg: logoSvg },
  { filename: 'logo@3x.png', width: 480, height: 150, svg: logoSvg },

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
  // The web card shows the same logo file the Wallet pass uses.
  const webDir = path.resolve(__dirname, '../public/card');
  fs.mkdirSync(webDir, { recursive: true });
  fs.copyFileSync(path.join(OUT_DIR, 'logo@3x.png'), path.join(webDir, 'logo.png'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
