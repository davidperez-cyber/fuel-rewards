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

/**
 * The strip is the only canvas Wallet lets us fully design, so it carries the card's UFC look: a
 * thin red rounded frame, gray planes + a red streak in two opposite corners (clipped to the frame,
 * like the web card) and an octagon-cage mesh in the bottom-left corner. Everything stays in the
 * margins around the stamp icons and the reward label.
 */
function panelArt(width: number, height: number): string {
  const RED = '#e21c24';
  const mx = width * 0.022;
  const my = height * 0.05;
  const fw = width - 2 * mx;
  const fh = height - 2 * my;
  const rx = height * 0.07;
  const sw = Math.max(2, height * 0.009);

  const k = 2.2; // streak steepness (dy per dx)
  const a = fw * 0.056; // gray plane, along the corner
  const r = fw * 0.032; // thick red streak, right next to it
  const g = fw * 0.018; // second gray plane beyond the streak
  const gap = fw * 0.004;
  const corner = [
    `<polygon points="0,0 ${a},0 0,${k * a}" fill="#2a2a2c"/>`,
    `<polygon points="${a + r + gap},0 ${a + r + gap + g},0 0,${k * (a + r + gap + g)} 0,${k * (a + r + gap)}" fill="#19191a"/>`,
    `<polygon points="${a},0 ${a + r},0 0,${k * (a + r)} 0,${k * a}" fill="${RED}"/>`,
  ].join('');

  // Cage mesh: a right triangle in the bottom-left corner with a lighter bevel along its diagonal.
  const x0 = mx;
  const yb = height - my;
  const ch = fh * 0.3;
  const step = Math.max(8, ch * 0.13);
  const mesh: string[] = [];
  for (let x = -ch; x <= ch; x += step) {
    mesh.push(`<line x1="${x0 + x}" y1="${yb}" x2="${x0 + x + ch}" y2="${yb - ch}"/>`);
    mesh.push(`<line x1="${x0 + x}" y1="${yb - ch}" x2="${x0 + x + ch}" y2="${yb}"/>`);
  }
  const tri = `${x0},${yb - ch} ${x0 + ch},${yb} ${x0},${yb}`;
  const cage = `<polygon points="${tri}" fill="#151516"/>
    <g clip-path="url(#cage)" stroke="#55555a" stroke-width="${Math.max(1, ch * 0.012)}" opacity="0.7">${mesh.join('')}</g>
    <g clip-path="url(#cage)"><line x1="${x0}" y1="${yb - ch}" x2="${x0 + ch}" y2="${yb}" stroke="#2c2c2e" stroke-width="${ch * 0.2}"/></g>`;

  return `<defs>
      <clipPath id="panel"><rect x="${mx}" y="${my}" width="${fw}" height="${fh}" rx="${rx}"/></clipPath>
      <clipPath id="cage"><polygon points="${tri}"/></clipPath>
    </defs>
    <g clip-path="url(#panel)">
      <g transform="translate(${mx} ${my})">${corner}</g>
      <g transform="rotate(180 ${width / 2} ${height / 2}) translate(${mx} ${my})">${corner}</g>
      ${cage}
    </g>
    <rect x="${mx + sw / 2}" y="${my + sw / 2}" width="${fw - sw}" height="${fh - sw}" rx="${rx}" fill="none" stroke="${RED}" stroke-width="${sw}"/>`;
}

function solidSvg(width: number, height: number, inner = ''): string {
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" fill="${BLACK}"/>${panelArt(width, height)}${inner}</svg>`;
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

  // Up to 6 stamps: one airy row (6 shakers, then the big gold one). More (stage 2): two rows.
  const oneRow = stamps.length <= 6;
  const padX = width * (oneRow ? 0.085 : 0.07);
  const padR = width * 0.095; // extra room on the right: the bottom-right streak must not touch the label
  const padY = height * 0.07;

  // Reward column (big gold shaker + label) on the right.
  const rewardIconH = height * (oneRow ? 0.6 : 0.68);
  const rewardIconW = rewardIconH * aspect;
  const rewardColW = rewardIconW + width * (oneRow ? 0.03 : 0.05);
  const rewardCx = width - padR - rewardIconW / 2;
  const labelFont = height * 0.1;
  // One row: icon + label are centered vertically as a block. Two rows: icon at the top.
  const labelGap = height * 0.03;
  const labelH = labelFont * 0.75;
  const rewardTop = oneRow ? (height - (rewardIconH + labelGap + labelH)) / 2 : padY;
  const labelCy = oneRow
    ? rewardTop + rewardIconH + labelGap + labelH / 2
    : rewardTop + rewardIconH + (height - padY - (rewardTop + rewardIconH)) / 2;

  // Stamp grid, filled left-to-right (then top-to-bottom), left of the reward column.
  const rows = oneRow ? 1 : 2;
  const cols = Math.ceil(stamps.length / rows);
  const gridW = width - padX - padR - rewardColW;
  const cellW = gridW / cols;
  const cellH = (height - padY * 2) / rows;
  const stampIconH = oneRow ? Math.min(height * 0.46, (cellW * 0.82) / aspect) : Math.min(cellH * 0.92, (cellW * 0.9) / aspect);
  const rowCy = (row: number) => (oneRow ? rewardTop + rewardIconH / 2 : padY + cellH * (row + 0.5));

  const labelSvg = reward
    ? centeredTextGroup(reward.label, labelFont, rewardCx, labelCy, reward.filled ? GOLD : GOLD_DIM)
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
    const cy = rowCy(row);
    return { input: icon.data, left: Math.round(cx - icon.info.width / 2), top: Math.round(cy - icon.info.height / 2) };
  });

  if (reward) {
    const icon = reward.filled ? goldIcon : goldDimIcon;
    composites.push({ input: icon.data, left: Math.round(rewardCx - icon.info.width / 2), top: Math.round(rewardTop) });
  }

  return sharp(base).composite(composites).png().toBuffer();
}
