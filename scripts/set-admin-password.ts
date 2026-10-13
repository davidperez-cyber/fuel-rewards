import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

/**
 * Sets a new password for a staff/admin account. The password is typed at a hidden prompt (it never
 * appears on screen, in shell history or in chat). Uses DATABASE_URL from .env — the same Neon
 * database production uses — so the change takes effect on the live site immediately.
 *
 *   npm run admin:password                      -> account admin@ufcgym.mx
 *   npm run admin:password -- otro@ufcgym.mx    -> a different staff account
 */

const prisma = new PrismaClient();

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const onData = (ch: string) => {
      for (const c of ch) {
        if (c === '\r' || c === '\n') {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (c === '\u0003') process.exit(1); // Ctrl+C
        if (c === '\u007f' || c === '\b') value = value.slice(0, -1);
        else value += c;
      }
    };
    stdin.on('data', onData);
  });
}

async function main() {
  const email = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'admin@ufcgym.mx';
  const user = await prisma.staffUser.findUnique({ where: { email } });
  if (!user) {
    const all = await prisma.staffUser.findMany({ select: { email: true, role: true } });
    console.log(`No existe la cuenta ${email}. Cuentas disponibles:`);
    for (const u of all) console.log(`  ${u.email} (${u.role})`);
    return;
  }

  const pw1 = await promptHidden(`Nueva contrasena para ${email} (minimo 10 caracteres): `);
  if (pw1.length < 10) {
    console.log('Muy corta: usa al menos 10 caracteres. No se cambio nada.');
    return;
  }
  const pw2 = await promptHidden('Repitela para confirmar: ');
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
