import type { StaffRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { ApiError } from '@/lib/api/errors';
import { getCurrentSession, type SessionPayload } from './session';

export async function requireStaff(roles?: StaffRole[]): Promise<SessionPayload> {
  const session = await getCurrentSession();
  if (!session) throw new ApiError(401, 'UNAUTHENTICATED', 'Inicia sesión para continuar.');
  // The account may have been deleted or its role changed since the session cookie was issued:
  // the database is the source of truth for every API call.
  const user = await prisma.staffUser.findUnique({ where: { id: session.sub }, select: { role: true, name: true } });
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Tu cuenta ya no existe. Inicia sesión otra vez.');
  const current: SessionPayload = { sub: session.sub, name: user.name, role: user.role };
  if (roles && roles.length > 0 && !roles.includes(current.role)) {
    throw new ApiError(403, 'FORBIDDEN', 'No tienes permisos para esta acción.');
  }
  return current;
}
