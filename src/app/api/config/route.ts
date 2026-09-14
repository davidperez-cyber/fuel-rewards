import { NextResponse } from 'next/server';
import { isGoogleWalletConfigured } from '@/lib/google/client';

/** Public: lets the frontend know which wallet integrations are actually usable right now. */
export async function GET() {
  return NextResponse.json({ googleWalletEnabled: isGoogleWalletConfigured() });
}
