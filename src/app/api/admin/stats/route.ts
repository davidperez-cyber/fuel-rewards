import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api/errors';
import { requireStaff } from '@/lib/auth/guard';
import { getAdminStats } from '@/lib/loyalty/service';

export async function GET() {
  try {
    await requireStaff(['ADMIN']);
    const stats = await getAdminStats();
    return NextResponse.json(stats);
  } catch (err) {
    return handleApiError(err);
  }
}
