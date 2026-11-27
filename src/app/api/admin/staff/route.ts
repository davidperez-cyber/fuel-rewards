import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api/errors';
import { requireStaff } from '@/lib/auth/guard';
import { createStaffSchema } from '@/lib/validation';
import { createStaff, listStaff } from '@/lib/auth/staffAccounts';

/** Staff accounts (admin only). */
export async function GET() {
  try {
    await requireStaff(['ADMIN']);
    return NextResponse.json(await listStaff());
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireStaff(['ADMIN']);
    await createStaff(createStaffSchema.parse(await req.json()));
    return NextResponse.json(await listStaff(), { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
