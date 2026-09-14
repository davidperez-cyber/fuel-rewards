import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { extractApplePassToken } from '@/lib/apple/webServiceAuth';
import { generatePkpassBuffer } from '@/lib/apple/passkit';

interface Params {
  params: { passTypeIdentifier: string; serialNumber: string };
}

/** PassKit Web Service: fetch the latest signed pass for a device that got a push notification. */
export async function GET(req: NextRequest, { params }: Params) {
  if (params.passTypeIdentifier !== process.env.APPLE_PASS_TYPE_IDENTIFIER) {
    return new NextResponse(null, { status: 404 });
  }

  const card = await prisma.loyaltyCard.findUnique({
    where: { serialNumber: params.serialNumber },
    include: { customer: true },
  });
  if (!card || !card.customer) return new NextResponse(null, { status: 404 });

  const token = extractApplePassToken(req);
  if (!token || token !== card.authenticationToken) {
    return new NextResponse(null, { status: 401 });
  }

  const ifModifiedSince = req.headers.get('if-modified-since');
  if (ifModifiedSince) {
    const since = new Date(ifModifiedSince);
    if (!Number.isNaN(since.getTime()) && card.passUpdatedAt.getTime() <= since.getTime()) {
      return new NextResponse(null, { status: 304 });
    }
  }

  const buffer = await generatePkpassBuffer(card, card.customer);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.apple.pkpass',
      'Last-Modified': card.passUpdatedAt.toUTCString(),
    },
  });
}
