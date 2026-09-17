import sharp from 'sharp';
import type { LoyaltyCard } from '@prisma/client';
import { buildCircles } from '@/lib/loyalty/rules';
import { centeredTextGroup } from './textPath';

/**
 * Renders the pass's strip image as the actual stamp-progress circles (red = filled, gray
 * outline = pending, gold = reward), matching the card design in scraps/pdf-page-*.png and the
 * same visual language as CardPreview.tsx in the web app — regenerated per download so it always
 * reflects the customer's real progress, since Apple Wallet's pass template has no native way to
 * show a dynamic row of stamps itself.
 */

const BLACK = '#0b0b0c';
const RED = '#e21c24';
const GOLD = '#cda86a';
const EMPTY_STROKE = '#3a3a3a';
const EMPTY_TEXT = '#6a6a6a';

function circleGridSvg(
  circles: Array<{ key: string; label: string; filled: boolean; kind: 'stamp' | 'reward' }>,
  width: number,
  height: number,
): string {
  const n = circles.length;
  const padX = width * 0.03;
  const padY = height * 0.12;
  const gap = width * 0.018;
  const usableW = width - padX * 2 - gap * (n - 1);
  const d = Math.min(usableW / n, height - padY * 2);
  const totalW = d * n + gap * (n - 1);
  const startX = (width - totalW) / 2;
  const cy = height / 2;

  const nodes = circles.map((c, i) => {
    const cx = startX + d / 2 + i * (d + gap);
    let fill: string;
    let stroke: string;
    let textFill: string;
    if (c.kind === 'reward') {
      fill = c.filled ? GOLD : 'none';
      stroke = GOLD;
      textFill = c.filled ? BLACK : GOLD;
    } else {
      fill = c.filled ? RED : 'none';
      stroke = c.filled ? RED : EMPTY_STROKE;
      textFill = c.filled ? '#ffffff' : EMPTY_TEXT;
    }
    const fontSize = c.kind === 'reward' ? d * 0.26 : d * 0.46;
    const labelGroup = centeredTextGroup(c.label, fontSize, cx, cy, textFill);
    return `<circle cx="${cx}" cy="${cy}" r="${d / 2 - 1.5}" fill="${fill}" stroke="${stroke}" stroke-width="${Math.max(1.5, d * 0.06)}"/>
      ${labelGroup}`;
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
