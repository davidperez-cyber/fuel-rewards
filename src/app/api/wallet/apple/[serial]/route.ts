import { NextRequest, NextResponse } from 'next/server';
import { ApiError, handleApiError } from '@/lib/api/errors';
import { findCardBySerial } from '@/lib/loyalty/service';
import { generatePkpassBuffer } from '@/lib/apple/passkit';

/**
 * Public download of the signed .pkpass for a card. Guarded by the card's own
 * authenticationToken (shown to the customer right after signup / on their card page) —
 * the same token PassKit Web Service uses for its own authenticated calls.
 */
export async function GET(req: NextRequest, { params }: { params: { serial: string } }) {
  try {
    const token = req.nextUrl.searchParams.get('t');
    const card = await findCardBySerial(params.serial);
    if (!card || !card.customer) throw new ApiError(404, 'CARD_NOT_FOUND', 'Tarjeta no encontrada.');
    if (!token || token !== card.authenticationToken) {
      throw new ApiError(401, 'INVALID_TOKEN', 'Token inválido.');
    }

    const buffer = await generatePkpassBuffer(card, card.customer);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Content-Disposition': `attachment; filename="fuel-${card.serialNumber}.pkpass"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
