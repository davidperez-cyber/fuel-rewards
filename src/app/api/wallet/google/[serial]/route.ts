import { NextRequest, NextResponse } from 'next/server';
import { ApiError, handleApiError } from '@/lib/api/errors';
import { findCardBySerial } from '@/lib/loyalty/service';
import { generateGoogleSaveLink } from '@/lib/google/wallet';

export async function GET(req: NextRequest, { params }: { params: { serial: string } }) {
  try {
    const token = req.nextUrl.searchParams.get('t');
    const card = await findCardBySerial(params.serial);
    if (!card || !card.customer) throw new ApiError(404, 'CARD_NOT_FOUND', 'Tarjeta no encontrada.');
    if (!token || token !== card.authenticationToken) {
      throw new ApiError(401, 'INVALID_TOKEN', 'Token inválido.');
    }

    const saveUrl = await generateGoogleSaveLink(card.id);
    return NextResponse.redirect(saveUrl);
  } catch (err) {
    return handleApiError(err);
  }
}
