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

/** Layout knobs, as fractions of the strip (stampH/rewardH/rowGap/gutter) or of the icon width (pitch). */
export interface StripTune {
  stampH: number; // shaker height / strip height
  rowGap: number; // vertical gap between the two rows / strip height
  pitch: number; // distance between shaker columns / shaker width
  rewardH: number; // gold shaker height / strip height
  gutter: number; // gap between the grid and the gold shaker / strip width
  labelFont: number; // reward label font size / strip height
}
const TUNE: StripTune = { stampH: 0.36, rowGap: 0.07, pitch: 2.2, rewardH: 0.47, gutter: 0.085, labelFont: 0.08 };

export async function generateStripPng(card: LoyaltyCard, width: number, height: number, tune: Partial<StripTune> = {}): Promise<Buffer> {
  const circles = buildCircles(card);

  if (circles.length === 0) {
    const label = centeredTextGroup('CICLO COMPLETADO', height * 0.16, width / 2, height / 2, GOLD);
    return sharp(Buffer.from(solidSvg(width, height, label))).png().toBuffer();
  }

  const stamps = circles.filter((c) => c.kind === 'stamp');
  const reward = circles.find((c) => c.kind === 'reward');

  const aspect = await sharp(loadIcons().filled).metadata().then((m) => (m.width ?? 1) / (m.height ?? 1));

  // Layout of the strip. Two rows of shakers, filled left-to-right then top-to-bottom, and the gold
  // reward on its own to the right. The whole group (grid + gutter + reward) is centered in the strip.
  const t = { ...TUNE, ...tune };
  const padX = width * 0.07;
  const padR = width * 0.095; // extra room on the right: the bottom-right streak must not touch the label
  const rows = 2;
  const cols = Math.ceil(stamps.length / rows);

  const rewardIconH = height * t.rewardH;
  const rewardIconW = rewardIconH * aspect;
  const labelFont = height * t.labelFont;
  const labelGap = height * 0.03;
  const labelH = labelFont * 0.75;
  const rewardTop = (height - (rewardIconH + labelGap + labelH)) / 2;
  const labelCy = rewardTop + rewardIconH + labelGap + labelH / 2;

  const areaW = width - padX - padR;
  const gutter = width * t.gutter;
  const gridAreaW = areaW - gutter - rewardIconW;
  // Many stamps (stage 2) are limited by the width of their column instead of the preferred height.
  const stampIconH = Math.min(height * t.stampH, ((gridAreaW / cols) * 0.9) / aspect);
  const stampIconW = stampIconH * aspect;
  const pitch = Math.min(gridAreaW / cols, stampIconW * t.pitch);
  const gridW = pitch * (cols - 1) + stampIconW;
  const groupW = gridW + gutter + rewardIconW;
  const gridLeft = padX + (areaW - groupW) / 2; // left edge of the first column's icon
  const rewardCx = gridLeft + gridW + gutter + rewardIconW / 2;
  const rowGap = height * t.rowGap;
  const rowCy = (row: number) => height / 2 + (row - (rows - 1) / 2) * (stampIconH + rowGap);

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
    const cx = gridLeft + stampIconW / 2 + pitch * col;
    return { input: icon.data, left: Math.round(cx - icon.info.width / 2), top: Math.round(rowCy(row) - icon.info.height / 2) };
  });

  if (reward) {
    const icon = reward.filled ? goldIcon : goldDimIcon;
    composites.push({ input: icon.data, left: Math.round(rewardCx - icon.info.width / 2), top: Math.round(rewardTop) });
  }

  return sharp(base).composite(composites).png().toBuffer();
}
