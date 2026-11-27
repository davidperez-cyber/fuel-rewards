import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api/errors';
import { requireStaff } from '@/lib/auth/guard';
import { updateStaffSchema } from '@/lib/validation';
import { deleteStaff, listStaff, updateStaff } from '@/lib/auth/staffAccounts';

/** Change a staff account's password or role (admin only). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireStaff(['ADMIN']);
    await updateStaff(params.id, session.sub, updateStaffSchema.parse(await req.json()));
    return NextResponse.json(await listStaff());
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireStaff(['ADMIN']);
    await deleteStaff(params.id, session.sub);
    return NextResponse.json(await listStaff());
  } catch (err) {
    return handleApiError(err);
  }
}
