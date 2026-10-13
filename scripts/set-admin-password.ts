import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { promptMasked } from './lib/prompt';

/**
 * Sets a new password for a staff/admin account. Uses DATABASE_URL from .env — the same Neon
 * database production uses — so the change takes effect on the live site immediately.
 *
 *   npm run admin:password                         -> account admin@ufcgym.mx
 *   npm run admin:password -- otro@ufcgym.mx       -> a different staff account
 *   npm run admin:password -- --visible            -> password shown as you type (fallback)
 *
 * By default each typed character shows as "*" so it is obvious the input is being captured;
 * the password never lands in shell history or in chat.
 */

const prisma = new PrismaClient();

async function main() {
  const email = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'admin@ufcgym.mx';
  const user = await prisma.staffUser.findUnique({ where: { email } });
  if (!user) {
    const all = await prisma.staffUser.findMany({ select: { email: true, role: true } });
    console.log(`No existe la cuenta ${email}. Cuentas disponibles:`);
    for (const u of all) console.log(`  ${u.email} (${u.role})`);
    return;
  }

  const pw1 = await promptMasked(`Nueva contrasena para ${email} (minimo 10 caracteres): `);
  if (pw1.length < 10) {
    console.log('Muy corta: usa al menos 10 caracteres. No se cambio nada.');
    return;
  }
  const pw2 = await promptMasked('Repitela para confirmar: ');
  if (pw1 !== pw2) {
    console.log('No coinciden. No se cambio nada.');
    return;
  }

  await prisma.staffUser.update({ where: { email }, data: { passwordHash: await bcrypt.hash(pw1, 10) } });
  console.log(`\nListo: la contrasena de ${email} ya cambio en el sitio real.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
