import { NextResponse } from 'next/server';
import { isGoogleWalletConfigured } from '@/lib/google/client';

// Must be evaluated per request: secrets only exist at runtime, so a build-time (static) answer
// would freeze "googleWalletEnabled" at false.
export const dynamic = 'force-dynamic';

/** Public: lets the frontend know which wallet integrations are actually usable right now. */
export async function GET() {
  return NextResponse.json({ googleWalletEnabled: isGoogleWalletConfigured() });
}
