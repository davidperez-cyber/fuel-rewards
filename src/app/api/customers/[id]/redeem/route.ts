import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ApiError, handleApiError } from '@/lib/api/errors';
import { requireStaff } from '@/lib/auth/guard';
import { redeemReward } from '@/lib/loyalty/service';
import { serializeCustomerWithCard } from '@/lib/loyalty/serialize';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireStaff();
    await redeemReward(params.id, session.sub);
    const customer = await prisma.customer.findUnique({ where: { id: params.id }, include: { card: true } });
    if (!customer || !customer.card) throw new ApiError(404, 'CUSTOMER_NOT_FOUND', 'Cliente no encontrado.');
    return NextResponse.json(serializeCustomerWithCard(customer, customer.card));
  } catch (err) {
    return handleApiError(err);
  }
}
