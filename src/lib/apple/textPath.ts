import fs from 'fs';
import path from 'path';
import opentype from 'opentype.js';

/**
 * Converts text to raw SVG <path> data using opentype.js instead of relying on <text> + a
 * font-family lookup. sharp's SVG rasterizer (librsvg) silently ignores @font-face embeds and
 * falls back to whatever generic font the host happens to have — which is a Windows-only serif
 * font here, and nothing at all on the Cloud Run container — so text.js rendering is not
 * reliable across environments. Pre-computed glyph outlines have no such dependency.
 *
 * opentype.js itself has a reproducible bug where calling Font.getPath() for the same text at
 * *different* font sizes across calls corrupts later results into NaN coordinates (confirmed by
 * hand: identical calls at a fixed size are fine, varying the size across calls is not). So each
 * unique string's path is computed exactly once, at a fixed reference size (unitsPerEm — i.e.
 * 1 SVG unit == 1 font unit), and every caller scales/positions it via an SVG transform instead
 * of asking opentype.js for a differently-sized path.
 */

let cachedFont: opentype.Font | null = null;
function loadFont(): opentype.Font {
  if (!cachedFont) {
    const fontPath = path.resolve(process.cwd(), 'assets/fonts/Anton-Regular.ttf');
    const buffer = fs.readFileSync(fontPath);
    cachedFont = opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  }
  return cachedFont;
}

interface RawGlyphPath {
  d: string; // path data at 1 unit == 1 font unit (unitsPerEm), baseline at y=0
  width: number; // advance width in font units
  unitsPerEm: number;
  capHeight: number; // in font units
}

const rawPathCache = new Map<string, RawGlyphPath>();

function getRawPath(text: string): RawGlyphPath {
  const cached = rawPathCache.get(text);
  if (cached) return cached;

  const font = loadFont();
  const unitsPerEm = font.unitsPerEm;
  const width = font.getAdvanceWidth(text, unitsPerEm);
  const d = font.getPath(text, 0, 0, unitsPerEm).toPathData(2);
  const capHeight = font.tables.os2?.sCapHeight ?? font.ascender * 0.72;
  const result: RawGlyphPath = { d, width, unitsPerEm, capHeight };
  rawPathCache.set(text, result);
  return result;
}

/** An SVG <g> element containing `text` rendered as a path, scaled to `fontSize`, top-left origin at (x, y-baseline handled internally to sit visually at (x, y) as the text's normal baseline). */
export function textGroup(text: string, fontSize: number, x: number, y: number, fill: string): { svg: string; width: number } {
  const raw = getRawPath(text);
  const scale = fontSize / raw.unitsPerEm;
  return {
    svg: `<g transform="translate(${x} ${y}) scale(${scale})"><path d="${raw.d}" fill="${fill}"/></g>`,
    width: raw.width * scale,
  };
}

/** An SVG <g> element containing `text` rendered as a path, centered at (cx, cy) at the given font size. */
export function centeredTextGroup(text: string, fontSize: number, cx: number, cy: number, fill: string): string {
  const raw = getRawPath(text);
  const scale = fontSize / raw.unitsPerEm;
  const width = raw.width * scale;
  const capHeight = raw.capHeight * scale;
  const x = cx - width / 2;
  const y = cy + capHeight / 2;
  return `<g transform="translate(${x} ${y}) scale(${scale})"><path d="${raw.d}" fill="${fill}"/></g>`;
}
