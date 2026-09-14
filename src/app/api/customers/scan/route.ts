import { NextRequest, NextResponse } from 'next/server';
import { ApiError, handleApiError } from '@/lib/api/errors';
import { requireStaff } from '@/lib/auth/guard';
import { findCardBySerial } from '@/lib/loyalty/service';
import { serializeCustomerWithCard } from '@/lib/loyalty/serialize';

/** Staff QR scan flow: the pass barcode encodes the card's serialNumber; look up the customer by it. */
export async function GET(req: NextRequest) {
  try {
    await requireStaff();
    const serial = req.nextUrl.searchParams.get('serial');
    if (!serial) throw new ApiError(400, 'MISSING_SERIAL', 'Falta el parámetro serial.');
    const card = await findCardBySerial(serial);
    if (!card || !card.customer) throw new ApiError(404, 'CARD_NOT_FOUND', 'No se encontró ninguna tarjeta con ese código.');
    return NextResponse.json(serializeCustomerWithCard(card.customer, card));
  } catch (err) {
    return handleApiError(err);
  }
}
