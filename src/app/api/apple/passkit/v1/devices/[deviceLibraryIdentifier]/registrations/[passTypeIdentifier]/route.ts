import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface Params {
  params: { deviceLibraryIdentifier: string; passTypeIdentifier: string };
}

/** PassKit Web Service: which of this device's registered passes changed since `passesUpdatedSince`. */
export async function GET(req: NextRequest, { params }: Params) {
  if (params.passTypeIdentifier !== process.env.APPLE_PASS_TYPE_IDENTIFIER) {
    return new NextResponse(null, { status: 404 });
  }

  const since = req.nextUrl.searchParams.get('passesUpdatedSince');
  const sinceDate = since ? new Date(since) : null;

  const registrations = await prisma.appleDeviceRegistration.findMany({
    where: { deviceLibraryIdentifier: params.deviceLibraryIdentifier },
    include: { card: true },
  });

  const updated = registrations
    .map((r) => r.card)
    .filter((card) => !sinceDate || card.passUpdatedAt.getTime() > sinceDate.getTime());

  if (updated.length === 0) return new NextResponse(null, { status: 204 });

  const lastUpdated = updated.reduce((max, c) => (c.passUpdatedAt > max ? c.passUpdatedAt : max), updated[0].passUpdatedAt);

  return NextResponse.json({
    lastUpdated: lastUpdated.toISOString(),
    serialNumbers: updated.map((c) => c.serialNumber),
  });
}
