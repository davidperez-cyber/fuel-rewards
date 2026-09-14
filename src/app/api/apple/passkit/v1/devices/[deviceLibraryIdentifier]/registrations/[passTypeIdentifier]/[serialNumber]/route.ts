import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { extractApplePassToken } from '@/lib/apple/webServiceAuth';

interface Params {
  params: { deviceLibraryIdentifier: string; passTypeIdentifier: string; serialNumber: string };
}

/** PassKit Web Service: register a device for push updates on a pass. */
export async function POST(req: NextRequest, { params }: Params) {
  if (params.passTypeIdentifier !== process.env.APPLE_PASS_TYPE_IDENTIFIER) {
    return new NextResponse(null, { status: 404 });
  }

  const card = await prisma.loyaltyCard.findUnique({ where: { serialNumber: params.serialNumber } });
  if (!card) return new NextResponse(null, { status: 404 });

  const token = extractApplePassToken(req);
  if (!token || token !== card.authenticationToken) {
    return new NextResponse(null, { status: 401 });
  }

  let pushToken: string | undefined;
  try {
    const body = await req.json();
    pushToken = body?.pushToken;
  } catch {
    // fallthrough — missing/invalid body handled below
  }
  if (!pushToken) return new NextResponse(null, { status: 400 });

  const existing = await prisma.appleDeviceRegistration.findUnique({
    where: { deviceLibraryIdentifier_cardId: { deviceLibraryIdentifier: params.deviceLibraryIdentifier, cardId: card.id } },
  });

  if (existing) {
    if (existing.pushToken !== pushToken) {
      await prisma.appleDeviceRegistration.update({ where: { id: existing.id }, data: { pushToken } });
    }
    return new NextResponse(null, { status: 200 });
  }

  await prisma.appleDeviceRegistration.create({
    data: { deviceLibraryIdentifier: params.deviceLibraryIdentifier, cardId: card.id, pushToken },
  });
  return new NextResponse(null, { status: 201 });
}

/** PassKit Web Service: unregister a device (user removed the pass). */
export async function DELETE(req: NextRequest, { params }: Params) {
  if (params.passTypeIdentifier !== process.env.APPLE_PASS_TYPE_IDENTIFIER) {
    return new NextResponse(null, { status: 404 });
  }

  const card = await prisma.loyaltyCard.findUnique({ where: { serialNumber: params.serialNumber } });
  if (!card) return new NextResponse(null, { status: 404 });

  const token = extractApplePassToken(req);
  if (!token || token !== card.authenticationToken) {
    return new NextResponse(null, { status: 401 });
  }

  await prisma.appleDeviceRegistration.deleteMany({
    where: { deviceLibraryIdentifier: params.deviceLibraryIdentifier, cardId: card.id },
  });
  return new NextResponse(null, { status: 200 });
}
