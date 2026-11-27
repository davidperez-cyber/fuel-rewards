import type { StaffRole } from '@prisma/client';
import { prisma } from '@/lib/db';
import { ApiError } from '@/lib/api/errors';
import { hashPassword } from './password';

export async function listStaff() {
  const users = await prisma.staffUser.findMany({
    orderBy: [{ role: 'desc' }, { name: 'asc' }],
    include: { _count: { select: { stampEvents: true } } },
  });
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    stamps: u._count.stampEvents,
    createdAt: u.createdAt.toISOString(),
  }));
}

export async function createStaff(input: { name: string; email: string; role: StaffRole; password: string }) {
  if (await prisma.staffUser.findUnique({ where: { email: input.email } })) {
    throw new ApiError(409, 'EMAIL_TAKEN', `Ya existe una cuenta con ${input.email}.`);
  }
  await prisma.staffUser.create({
    data: { name: input.name, email: input.email, role: input.role, passwordHash: await hashPassword(input.password) },
  });
}

async function adminCount() {
  return prisma.staffUser.count({ where: { role: 'ADMIN' } });
}

export async function updateStaff(id: string, actorId: string, input: { password?: string; role?: StaffRole }) {
  const user = await prisma.staffUser.findUnique({ where: { id } });
  if (!user) throw new ApiError(404, 'STAFF_NOT_FOUND', 'Cuenta no encontrada.');
  if (input.role === 'STAFF' && user.role === 'ADMIN') {
    if (id === actorId) throw new ApiError(409, 'SELF_DEMOTE', 'No puedes quitarte el rol de admin a ti mismo.');
    if ((await adminCount()) <= 1) throw new ApiError(409, 'LAST_ADMIN', 'Debe quedar al menos un admin.');
  }
  await prisma.staffUser.update({
    where: { id },
    data: {
      ...(input.role ? { role: input.role } : {}),
      ...(input.password ? { passwordHash: await hashPassword(input.password) } : {}),
    },
  });
}

export async function deleteStaff(id: string, actorId: string) {
  const user = await prisma.staffUser.findUnique({ where: { id } });
  if (!user) throw new ApiError(404, 'STAFF_NOT_FOUND', 'Cuenta no encontrada.');
  if (id === actorId) throw new ApiError(409, 'SELF_DELETE', 'No puedes borrar tu propia cuenta.');
  if (user.role === 'ADMIN' && (await adminCount()) <= 1) throw new ApiError(409, 'LAST_ADMIN', 'Debe quedar al menos un admin.');
  // Stamps/redemptions this person gave stay in the history (their staff link becomes empty).
  await prisma.staffUser.delete({ where: { id } });
}
