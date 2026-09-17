import sharp from 'sharp';
import type { LoyaltyCard } from '@prisma/client';
import { buildCircles } from '@/lib/loyalty/rules';
import { centeredTextGroup } from './textPath';

/**
 * Renders the pass's strip image as the actual stamp progress — a shaker/bottle icon per
 * Protein Shake purchased (filled red once earned, gray outline while pending) plus a gold
 * "GRATIS"/"SHAKER" reward circle — regenerated per download so it always reflects the
 * customer's real progress, since Apple Wallet's pass template has no native way to show a
 * dynamic row of stamps itself.
 */

const BLACK = '#0b0b0c';
const RED = '#e21c24';
const GOLD = '#cda86a';
const EMPTY_STROKE = '#3a3a3a';

// A simple protein-shaker silhouette (cap + neck + bottle body + two measurement lines),
// drawn in a 60x90 local coordinate space with the origin at its top-left corner.
function shakerIconGroup(cx: number, cy: number, size: number, filled: boolean): string {
  const iconW = 60;
  const iconH = 90;
  const scale = size / iconH;
  const tx = cx - (iconW * scale) / 2;
  const ty = cy - (iconH * scale) / 2;

  const bodyFill = filled ? RED : 'none';
  const strokeColor = filled ? RED : EMPTY_STROKE;
  const lineColor = filled ? '#ffffff' : EMPTY_STROKE;
  const strokeWidth = filled ? 0 : 3;

  return `<g transform="translate(${tx} ${ty}) scale(${scale})">
    <rect x="18" y="0" width="24" height="13" rx="4" fill="${bodyFill}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
    <rect x="22" y="11" width="16" height="9" fill="${bodyFill}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
    <rect x="6" y="18" width="48" height="70" rx="13" fill="${bodyFill}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
    <line x1="15" y1="64" x2="45" y2="64" stroke="${lineColor}" stroke-width="3" stroke-linecap="round"/>
    <line x1="15" y1="75" x2="45" y2="75" stroke="${lineColor}" stroke-width="3" stroke-linecap="round"/>
  </g>`;
}

function circleGridSvg(
  circles: Array<{ key: string; label: string; filled: boolean; kind: 'stamp' | 'reward' }>,
  width: number,
  height: number,
): string {
  const n = circles.length;
  const padX = width * 0.03;
  const padY = height * 0.1;
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
    return shakerIconGroup(cx, cy, d * 0.92, c.filled);
  });

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="${BLACK}"/>
    ${nodes.join('\n')}
  </svg>`;
}

function completedSvg(width: number, height: number): string {
  const fs = height * 0.24;
  const labelGroup = centeredTextGroup('CICLO COMPLETADO', fs, width / 2, height / 2, GOLD);
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="${BLACK}"/>
    ${labelGroup}
  </svg>`;
}

export async function generateStripPng(card: LoyaltyCard, width: number, height: number): Promise<Buffer> {
  const circles = buildCircles(card);
  const svg = circles.length > 0 ? circleGridSvg(circles, width, height) : completedSvg(width, height);
  return sharp(Buffer.from(svg)).png().toBuffer();
}
