import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ApiError, handleApiError } from '@/lib/api/errors';
import { requireStaff } from '@/lib/auth/guard';
import { serializeCustomerWithCard } from '@/lib/loyalty/serialize';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireStaff();
    const customer = await prisma.customer.findUnique({ where: { id: params.id }, include: { card: true } });
    if (!customer || !customer.card) throw new ApiError(404, 'CUSTOMER_NOT_FOUND', 'Cliente no encontrado.');
    return NextResponse.json(serializeCustomerWithCard(customer, customer.card));
  } catch (err) {
    return handleApiError(err);
  }
}
