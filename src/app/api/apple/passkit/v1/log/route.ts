import { NextRequest, NextResponse } from 'next/server';

/** PassKit Web Service: device-side error logging. Unauthenticated per Apple's spec. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const logs: string[] = Array.isArray(body?.logs) ? body.logs : [];
    for (const line of logs) console.warn('[Apple Wallet device log]', line);
  } catch {
    // ignore malformed log bodies
  }
  return new NextResponse(null, { status: 200 });
}
