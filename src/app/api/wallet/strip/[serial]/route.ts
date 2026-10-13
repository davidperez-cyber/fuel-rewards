import { NextRequest, NextResponse } from 'next/server';
import { ApiError, handleApiError } from '@/lib/api/errors';
import { findCardBySerial } from '@/lib/loyalty/service';
import { generateStripPng } from '@/lib/apple/stripImage';

/**
 * Public PNG of the customer's stamp-progress strip, used as the hero image of their Google Wallet
 * card (Google fetches it by URL). Guarded by the card's token like the other wallet endpoints; the
 * `v` query param only exists so the URL changes when stamps change and Google refetches it.
 */
export async function GET(req: NextRequest, { params }: { params: { serial: string } }) {
  try {
    const token = req.nextUrl.searchParams.get('t');
    const card = await findCardBySerial(params.serial);
    if (!card || !card.customer) throw new ApiError(404, 'CARD_NOT_FOUND', 'Tarjeta no encontrada.');
    if (!token || token !== card.authenticationToken) throw new ApiError(401, 'INVALID_TOKEN', 'Token inválido.');

    const png = await generateStripPng(card, 1032, 336);
    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
