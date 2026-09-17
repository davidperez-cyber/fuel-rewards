import sharp from 'sharp';
import type { LoyaltyCard } from '@prisma/client';
import { buildCircles } from '@/lib/loyalty/rules';
import { centeredTextGroup } from './textPath';

/**
 * Renders the pass's strip image as the actual stamp progress — a shaker-bottle icon per
 * Protein Shake purchased (filled red once earned, gray outline while pending) plus a gold
 * "GRATIS"/"SHAKER" reward circle — regenerated per download so it always reflects the
 * customer's real progress, since Apple Wallet's pass template has no native way to show a
 * dynamic row of stamps itself.
 */

const BLACK = '#0b0b0c';
const RED = '#e21c24';
const GOLD = '#cda86a';
const EMPTY_STROKE = '#3a3a3a';

/** A subtle diagonal-line texture behind the icons, echoing the brand reference card. */
function backgroundTexture(width: number, height: number): string {
  const stripes: string[] = [];
  const gap = height * 0.5;
  for (let x = -height; x < width + height; x += gap) {
    stripes.push(`<line x1="${x}" y1="${height}" x2="${x + height}" y2="0" stroke="#161617" stroke-width="${height * 0.04}"/>`);
  }
  return `<rect width="${width}" height="${height}" fill="${BLACK}"/><g>${stripes.join('')}</g>`;
}

// A protein-shaker silhouette (flip-cap spout + lid + tapered body + liquid line), drawn in a
// 60x92 local coordinate space, modeled on the classic shaker-bottle icon shape.
function shakerIconGroup(cx: number, cy: number, size: number, filled: boolean): string {
  const iconW = 60;
  const iconH = 92;
  const scale = size / iconH;
  const tx = cx - (iconW * scale) / 2;
  const ty = cy - (iconH * scale) / 2;

  const solid = filled ? RED : 'none';
  const strokeColor = filled ? RED : EMPTY_STROKE;
  const strokeWidth = filled ? 0 : 3;
  const waveColor = filled ? BLACK : 'none';

  return `<g transform="translate(${tx} ${ty}) scale(${scale})">
    <path d="M38 2 Q50 2 50 10 L44 14 Q40 10 33 11 Z" fill="${solid}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>
    <rect x="12" y="8" width="30" height="15" rx="6" fill="${solid}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
    <rect x="8" y="27" width="44" height="62" rx="9" fill="${solid}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
    <path d="M8 58 Q20 51 30 58 T52 58 L52 89 Q52 89 30 89 Q8 89 8 89 Z" fill="${waveColor}"/>
  </g>`;
}

function circleGridSvg(
  circles: Array<{ key: string; label: string; filled: boolean; kind: 'stamp' | 'reward' }>,
  width: number,
  height: number,
): string {
  const n = circles.length;
  const padX = width * 0.03;
  const padY = height * 0.08;
  const gap = width * 0.02;
  const usableW = width - padX * 2 - gap * (n - 1);
  const d = Math.min(usableW / n, height - padY * 2);
  const totalW = d * n + gap * (n - 1);
  const startX = (width - totalW) / 2;
  const cy = height / 2;

  const nodes = circles.map((c, i) => {
    const cx = startX + d / 2 + i * (d + gap);
    if (c.kind === 'reward') {
      const fill = c.filled ? GOLD : 'none';
      const textFill = c.filled ? BLACK : GOLD;
      const fontSize = d * 0.26;
      const labelGroup = centeredTextGroup(c.label, fontSize, cx, cy, textFill);
      return `<circle cx="${cx}" cy="${cy}" r="${d / 2 - 1.5}" fill="${fill}" stroke="${GOLD}" stroke-width="${Math.max(1.5, d * 0.06)}"/>
        ${labelGroup}`;
    }
    return shakerIconGroup(cx, cy, d * 0.96, c.filled);
  });

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    ${backgroundTexture(width, height)}
    ${nodes.join('\n')}
  </svg>`;
}

function completedSvg(width: number, height: number): string {
  const fs = height * 0.24;
  const labelGroup = centeredTextGroup('CICLO COMPLETADO', fs, width / 2, height / 2, GOLD);
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    ${backgroundTexture(width, height)}
    ${labelGroup}
  </svg>`;
}

export async function generateStripPng(card: LoyaltyCard, width: number, height: number): Promise<Buffer> {
  const circles = buildCircles(card);
  const svg = circles.length > 0 ? circleGridSvg(circles, width, height) : completedSvg(width, height);
  return sharp(Buffer.from(svg)).png().toBuffer();
}
