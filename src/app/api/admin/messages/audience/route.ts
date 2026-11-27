import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api/errors';
import { requireStaff } from '@/lib/auth/guard';
import { broadcastAudienceSchema } from '@/lib/validation';
import { findAudience } from '@/lib/loyalty/broadcast';

/** Preview: which customers an audience filter selects (admin only). */
export async function POST(req: NextRequest) {
  try {
    await requireStaff(['ADMIN']);
    const audience = broadcastAudienceSchema.parse(await req.json());
    return NextResponse.json(await findAudience(audience));
  } catch (err) {
    return handleApiError(err);
  }
}
