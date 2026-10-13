import 'dotenv/config';
import { PrismaClient, type StaffRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { promptMasked, promptVisible } from './lib/prompt';

/**
 * Creates a staff account (default role STAFF: can search customers, add stamps, redeem and reset;
 * ADMIN additionally sees the admin dashboard). Asks for name, email and password interactively.
 * Uses DATABASE_URL from .env — the same Neon database production uses — so it works on the live
 * site immediately.
 *
 *   npm run staff:create               -> role STAFF
 *   npm run staff:create -- --admin    -> role ADMIN
 *   npm run staff:create -- --visible  -> password shown while typing (fallback)
 */

const prisma = new PrismaClient();

async function main() {
  const role: StaffRole = process.argv.includes('--admin') ? 'ADMIN' : 'STAFF';
  console.log(`Crear cuenta con rol ${role}\n`);

  const name = (await promptVisible('Nombre del empleado: ')).trim();
  const email = (await promptVisible('Correo (sera su usuario): ')).trim().toLowerCase();
  if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email)) {
    console.log('Nombre o correo invalido. No se creo nada.');
    return;
  }
  if (await prisma.staffUser.findUnique({ where: { email } })) {
    console.log(`Ya existe una cuenta con ${email}. No se creo nada.`);
    return;
  }

  const pw1 = await promptMasked('Contrasena (minimo 10 caracteres): ');
  if (pw1.length < 10) {
    console.log('Muy corta: usa al menos 10 caracteres. No se creo nada.');
    return;
  }
  const pw2 = await promptMasked('Repitela para confirmar: ');
  if (pw1 !== pw2) {
    console.log('No coinciden. No se creo nada.');
    return;
  }

  await prisma.staffUser.create({ data: { name, email, role, passwordHash: await bcrypt.hash(pw1, 10) } });
  console.log(`\nListo: ${name} (${email}) ya puede entrar en /login con rol ${role}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
