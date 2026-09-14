import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/auth/password';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@ufcgym.mx';
  const password = process.env.SEED_ADMIN_PASSWORD || 'change-me-now';

  const existing = await prisma.staffUser.findUnique({ where: { email } });
  if (existing) {
    console.log(`Staff admin ya existe: ${email}`);
    return;
  }

  await prisma.staffUser.create({
    data: {
      name: 'Administrador',
      email,
      passwordHash: await hashPassword(password),
      role: 'ADMIN',
    },
  });
  console.log(`Cuenta admin creada: ${email} (cambia la contraseña después de tu primer login)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
