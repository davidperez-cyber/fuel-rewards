import type { NextRequest } from 'next/server';

/** Apple's PassKit Web Service sends `Authorization: ApplePass <authenticationToken>`. */
export function extractApplePassToken(req: NextRequest): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const match = /^ApplePass\s+(.+)$/i.exec(header.trim());
  return match ? match[1] : null;
}
