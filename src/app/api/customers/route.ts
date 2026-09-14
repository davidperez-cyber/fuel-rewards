import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api/errors';
import { requireStaff } from '@/lib/auth/guard';
import { registerCustomerSchema } from '@/lib/validation';
import { registerCustomer, searchCustomers } from '@/lib/loyalty/service';
import { serializeCustomerWithCard } from '@/lib/loyalty/serialize';

/** Public: customer self-registration from the signup screen. */
export async function POST(req: NextRequest) {
  try {
    const body = registerCustomerSchema.parse(await req.json());
    const customer = await registerCustomer({ name: body.name, phone: body.phone, email: body.email || null });
    return NextResponse.json(serializeCustomerWithCard(customer, customer.card!), { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

/** Staff/admin: search & list customers for the staff and admin panels. */
export async function GET(req: NextRequest) {
  try {
    await requireStaff();
    const q = req.nextUrl.searchParams.get('q') || '';
    const results = await searchCustomers(q);
    return NextResponse.json(results.map((c) => serializeCustomerWithCard(c, c.card)));
  } catch (err) {
    return handleApiError(err);
  }
}
