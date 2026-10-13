import fs from 'fs';
import path from 'path';
import sharp, { type OverlayOptions } from 'sharp';
import type { LoyaltyCard } from '@prisma/client';
import { buildCircles } from '@/lib/loyalty/rules';
import { centeredTextGroup } from './textPath';

/**
 * Renders the pass's strip image: the brand's real shaker artwork per Protein Shake in a 2-row
 * grid (bright once earned, dimmed while pending) with one big gold shaker on the right as the
 * reward ("GRATIS" / "SHAKER"), on the same solid black as the pass — mirroring the layout of the
 * original card design. Regenerated per download so it always reflects the customer's progress,
 * since Apple Wallet has no native way to show a dynamic row of stamps.
 *
 * Wallet displays the strip in a roughly 2.5:1 box and crops (aspect-fill) anything outside it, so
 * the image is built at that ratio (see STRIP_SIZES in passkit.ts) with side margins to spare.
 *
 * Icons are pre-built from assets/apple-pass/source/shaker-reference.png by
 * scripts/generate-shaker-icons.ts.
 */

const BLACK = '#0b0b0c';
const GOLD = '#cda86a';
const GOLD_DIM = '#b39560';

type IconName = 'filled' | 'empty' | 'gold' | 'goldDim';
const ICON_FILES: Record<IconName, string> = {
  filled: 'shaker-filled.png',
  empty: 'shaker-empty.png',
  gold: 'shaker-gold.png',
  goldDim: 'shaker-gold-dim.png',
};

let iconCache: Record<IconName, Buffer> | null = null;
function loadIcons(): Record<IconName, Buffer> {
  if (!iconCache) {
    const dir = path.resolve(process.cwd(), 'assets/apple-pass');
    iconCache = Object.fromEntries(
      (Object.keys(ICON_FILES) as IconName[]).map((k) => [k, fs.readFileSync(path.join(dir, ICON_FILES[k]))]),
    ) as Record<IconName, Buffer>;
  }
  return iconCache;
}

async function resizedIcon(name: IconName, height: number) {
  return sharp(loadIcons()[name]).resize({ height: Math.max(1, Math.round(height)) }).png().toBuffer({ resolveWithObject: true });
}

function solidSvg(width: number, height: number, inner = ''): string {
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" fill="${BLACK}"/>${inner}</svg>`;
}

export async function generateStripPng(card: LoyaltyCard, width: number, height: number): Promise<Buffer> {
  const circles = buildCircles(card);

  if (circles.length === 0) {
    const label = centeredTextGroup('CICLO COMPLETADO', height * 0.16, width / 2, height / 2, GOLD);
    return sharp(Buffer.from(solidSvg(width, height, label))).png().toBuffer();
  }

  const stamps = circles.filter((c) => c.kind === 'stamp');
  const reward = circles.find((c) => c.kind === 'reward');

  const aspect = await sharp(loadIcons().filled).metadata().then((m) => (m.width ?? 1) / (m.height ?? 1));

  const padX = width * 0.07;
  const padY = height * 0.07;

  // Reward column (big gold shaker + label) on the right.
  const rewardIconH = height * 0.68;
  const rewardIconW = rewardIconH * aspect;
  const rewardColW = rewardIconW + width * 0.05;
  const rewardCx = width - padX - rewardIconW / 2;
  const rewardTop = padY;
  const labelCy = rewardTop + rewardIconH + (height - padY - (rewardTop + rewardIconH)) / 2;

  // Stamp grid: 2 rows, filled left-to-right then top-to-bottom, left of the reward column.
  const rows = 2;
  const cols = Math.ceil(stamps.length / rows);
  const gridW = width - padX * 2 - rewardColW;
  const cellW = gridW / cols;
  const cellH = (height - padY * 2) / rows;
  const stampIconH = Math.min(cellH * 0.92, (cellW * 0.9) / aspect);

  const labelSvg = reward
    ? centeredTextGroup(reward.label, height * 0.1, rewardCx, labelCy, reward.filled ? GOLD : GOLD_DIM)
    : '';
  const base = await sharp(Buffer.from(solidSvg(width, height, labelSvg))).png().toBuffer();

  const [filledIcon, emptyIcon, goldIcon, goldDimIcon] = await Promise.all([
    resizedIcon('filled', stampIconH),
    resizedIcon('empty', stampIconH),
    resizedIcon('gold', rewardIconH),
    resizedIcon('goldDim', rewardIconH),
  ]);

  const composites: OverlayOptions[] = stamps.map((s, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const icon = s.filled ? filledIcon : emptyIcon;
    const cx = padX + cellW * (col + 0.5);
    const cy = padY + cellH * (row + 0.5);
    return { input: icon.data, left: Math.round(cx - icon.info.width / 2), top: Math.round(cy - icon.info.height / 2) };
  });

  if (reward) {
    const icon = reward.filled ? goldIcon : goldDimIcon;
    composites.push({ input: icon.data, left: Math.round(rewardCx - icon.info.width / 2), top: Math.round(rewardTop) });
  }

  return sharp(base).composite(composites).png().toBuffer();
}
