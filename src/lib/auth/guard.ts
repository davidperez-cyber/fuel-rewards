import type { StaffRole } from '@prisma/client';
import { ApiError } from '@/lib/api/errors';
import { getCurrentSession, type SessionPayload } from './session';

export async function requireStaff(roles?: StaffRole[]): Promise<SessionPayload> {
  const session = await getCurrentSession();
  if (!session) throw new ApiError(401, 'UNAUTHENTICATED', 'Inicia sesión para continuar.');
  if (roles && roles.length > 0 && !roles.includes(session.role)) {
    throw new ApiError(403, 'FORBIDDEN', 'No tienes permisos para esta acción.');
  }
  return session;
}
