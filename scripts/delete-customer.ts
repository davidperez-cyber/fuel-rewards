import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

/**
 * Deletes ONE customer by phone number (and, via cascade, their loyalty card, stamp/redemption
 * events and Apple device registrations). Staff/admin accounts are not touched.
 *
 *   npm run customer:delete -- 5512345678              -> shows who would be deleted
 *   npm run customer:delete -- 5512345678 --confirm    -> actually deletes (irreversible)
 *
 * Uses DATABASE_URL from .env, which is the same Neon database production uses.
 */

const prisma = new PrismaClient();

async function main() {
  const phone = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (!phone) {
    console.error('Falta el telefono. Ejemplo: npm run customer:delete -- 5512345678');
    process.exit(1);
  }

  const customer = await prisma.customer.findUnique({ where: { phone }, include: { card: true } });
  if (!customer) {
    console.log(`No hay ningun cliente con el telefono ${phone}.`);
    const all = await prisma.customer.findMany({ select: { name: true, phone: true }, orderBy: { createdAt: 'desc' } });
    console.log('\nClientes registrados:');
    for (const c of all) console.log(`  ${c.name}  -  ${c.phone}`);
    return;
  }

  console.log(`Cliente: ${customer.name} | Telefono: ${customer.phone} | Sellos: ${customer.card?.stamps ?? 0}`);

  if (!process.argv.includes('--confirm')) {
    console.log(`\nSimulacion: no se borro nada. Para borrar de verdad corre:\n  npm run customer:delete -- ${phone} --confirm`);
    return;
  }

  await prisma.customer.delete({ where: { id: customer.id } });
  console.log('\nCliente borrado.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
