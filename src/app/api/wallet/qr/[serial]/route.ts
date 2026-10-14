import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { ApiError, handleApiError } from '@/lib/api/errors';
import { findCardBySerial } from '@/lib/loyalty/service';

/**
 * SVG QR for the web version of a customer's card. It encodes exactly what the Wallet pass barcode
 * encodes (the card's serialNumber), so the staff scanner treats both the same. Guarded by the
 * card's token like the other wallet endpoints.
 */
export async function GET(req: NextRequest, { params }: { params: { serial: string } }) {
  try {
    const token = req.nextUrl.searchParams.get('t');
    const card = await findCardBySerial(params.serial);
    if (!card) throw new ApiError(404, 'CARD_NOT_FOUND', 'Tarjeta no encontrada.');
    if (!token || token !== card.authenticationToken) throw new ApiError(401, 'INVALID_TOKEN', 'Token inválido.');

    const svg = await QRCode.toString(card.serialNumber, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
    return new NextResponse(svg, {
      status: 200,
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'private, max-age=3600' },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
