import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import type { LoyaltyCard } from '@prisma/client';
import { buildCircles } from '@/lib/loyalty/rules';
import { centeredTextGroup } from './textPath';

/**
 * Renders the pass's strip image as the actual stamp progress: the brand's real shaker artwork
 * per Protein Shake (bright once earned, dimmed gray while pending) plus a gold "GRATIS"/"SHAKER"
 * reward circle — regenerated per download so it always reflects the customer's real progress,
 * since Apple Wallet's pass template has no native way to show a dynamic row of stamps itself.
 *
 * The icons are pre-built from assets/apple-pass/source/shaker-reference.png by
 * scripts/generate-shaker-icons.ts and composited onto the strip here.
 */

const BLACK = '#0b0b0c';
const GOLD = '#cda86a';

let iconCache: { filled: Buffer; empty: Buffer } | null = null;
function loadIcons(): { filled: Buffer; empty: Buffer } {
  if (!iconCache) {
    const dir = path.resolve(process.cwd(), 'assets/apple-pass');
    iconCache = {
      filled: fs.readFileSync(path.join(dir, 'shaker-filled.png')),
      empty: fs.readFileSync(path.join(dir, 'shaker-empty.png')),
    };
  }
  return iconCache;
}

/** A subtle diagonal-line texture behind the icons, echoing the brand reference card. */
function backgroundTexture(width: number, height: number): string {
  const stripes: string[] = [];
  const gap = height * 0.5;
  for (let x = -height; x < width + height; x += gap) {
    stripes.push(`<line x1="${x}" y1="${height}" x2="${x + height}" y2="0" stroke="#161617" stroke-width="${height * 0.04}"/>`);
  }
  return `<rect width="${width}" height="${height}" fill="${BLACK}"/><g>${stripes.join('')}</g>`;
}

interface Slot {
  kind: 'stamp' | 'reward';
  filled: boolean;
  label: string;
  cx: number;
  cy: number;
  d: number;
}

function layoutSlots(
  circles: Array<{ key: string; label: string; filled: boolean; kind: 'stamp' | 'reward' }>,
  width: number,
  height: number,
): Slot[] {
  const n = circles.length;
  const padX = width * 0.03;
  const padY = height * 0.08;
  const gap = width * 0.02;
  const usableW = width - padX * 2 - gap * (n - 1);
  const d = Math.min(usableW / n, height - padY * 2);
  const totalW = d * n + gap * (n - 1);
  const startX = (width - totalW) / 2;
  const cy = height / 2;
  return circles.map((c, i) => ({ kind: c.kind, filled: c.filled, label: c.label, cx: startX + d / 2 + i * (d + gap), cy, d }));
}

function baseSvg(slots: Slot[], width: number, height: number): string {
  const rewards = slots
    .filter((s) => s.kind === 'reward')
    .map((s) => {
      const fill = s.filled ? GOLD : 'none';
      const textFill = s.filled ? BLACK : GOLD;
      const label = centeredTextGroup(s.label, s.d * 0.26, s.cx, s.cy, textFill);
      return `<circle cx="${s.cx}" cy="${s.cy}" r="${s.d / 2 - 1.5}" fill="${fill}" stroke="${GOLD}" stroke-width="${Math.max(1.5, s.d * 0.06)}"/>${label}`;
    });
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    ${backgroundTexture(width, height)}
    ${rewards.join('\n')}
  </svg>`;
}

function completedSvg(width: number, height: number): string {
  const label = centeredTextGroup('CICLO COMPLETADO', height * 0.24, width / 2, height / 2, GOLD);
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    ${backgroundTexture(width, height)}
    ${label}
  </svg>`;
}

export async function generateStripPng(card: LoyaltyCard, width: number, height: number): Promise<Buffer> {
  const circles = buildCircles(card);
  if (circles.length === 0) {
    return sharp(Buffer.from(completedSvg(width, height))).png().toBuffer();
  }

  const slots = layoutSlots(circles, width, height);
  const base = await sharp(Buffer.from(baseSvg(slots, width, height))).png().toBuffer();

  const icons = loadIcons();
  const stampSlots = slots.filter((s) => s.kind === 'stamp');
  const iconHeight = Math.round(stampSlots[0].d * 0.96);
  const [filledIcon, emptyIcon] = await Promise.all([
    sharp(icons.filled).resize({ height: iconHeight }).png().toBuffer({ resolveWithObject: true }),
    sharp(icons.empty).resize({ height: iconHeight }).png().toBuffer({ resolveWithObject: true }),
  ]);

  const composites = stampSlots.map((s) => {
    const icon = s.filled ? filledIcon : emptyIcon;
    return {
      input: icon.data,
      left: Math.round(s.cx - icon.info.width / 2),
      top: Math.round(s.cy - icon.info.height / 2),
    };
  });

  return sharp(base).composite(composites).png().toBuffer();
}
