import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api/errors';
import { requireStaff } from '@/lib/auth/guard';
import { sendBroadcastSchema } from '@/lib/validation';
import { describeAudience, listBroadcasts, sendBroadcast } from '@/lib/loyalty/broadcast';

// Sending to many cards can take a while (one APNs push + Google call per card).
export const maxDuration = 300;

/** History of messages sent to Wallet (admin only). */
export async function GET() {
  try {
    await requireStaff(['ADMIN']);
    return NextResponse.json(await listBroadcasts());
  } catch (err) {
    return handleApiError(err);
  }
}

/** Sends a message to the selected customers' Wallet cards (admin only). */
export async function POST(req: NextRequest) {
  try {
    const session = await requireStaff(['ADMIN']);
    const body = sendBroadcastSchema.parse(await req.json());
    const result = await sendBroadcast({
      message: body.message,
      customerIds: body.customerIds,
      audienceLabel: describeAudience(body.audience),
      staffUserId: session.sub,
    });
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
