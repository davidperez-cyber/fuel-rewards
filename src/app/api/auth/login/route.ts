import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';
import { createSessionToken, sessionCookieOptions } from '@/lib/auth/session';
import { handleApiError } from '@/lib/api/errors';
import { loginSchema } from '@/lib/validation';

export async function POST(req: NextRequest) {
  try {
    const body = loginSchema.parse(await req.json());
    const user = await prisma.staffUser.findUnique({ where: { email: body.email } });
    const valid = user ? await verifyPassword(body.password, user.passwordHash) : false;
    if (!user || !valid) {
      return NextResponse.json({ error: { code: 'INVALID_CREDENTIALS', message: 'Correo o contraseña incorrectos.' } }, { status: 401 });
    }

    const token = await createSessionToken({ sub: user.id, name: user.name, role: user.role });
    const res = NextResponse.json({ id: user.id, name: user.name, role: user.role });
    res.cookies.set({ ...sessionCookieOptions(), value: token });
    return res;
  } catch (err) {
    return handleApiError(err);
  }
}
