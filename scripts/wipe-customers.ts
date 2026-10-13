import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

/**
 * Deletes ALL customers and, via cascade, their loyalty cards, stamp/redemption/reset events and
 * Apple device registrations. Staff/admin accounts are NOT touched.
 *
 *   npm run customers:wipe              -> only shows what would be deleted
 *   npm run customers:wipe -- --confirm -> actually deletes (irreversible)
 *
 * Uses DATABASE_URL from .env, which is the same Neon database production uses.
 */

const prisma = new PrismaClient();

async function main() {
  const [customers, cards, stamps, redemptions] = await Promise.all([
    prisma.customer.count(),
    prisma.loyaltyCard.count(),
    prisma.stampEvent.count(),
    prisma.redemptionEvent.count(),
  ]);
  console.log(`Clientes: ${customers} | Tarjetas: ${cards} | Sellos: ${stamps} | Canjes: ${redemptions}`);

  if (!process.argv.includes('--confirm')) {
    console.log('\nSimulacion: no se borro nada. Para borrar de verdad corre:\n  npm run customers:wipe -- --confirm');
    return;
  }

  const result = await prisma.customer.deleteMany();
  console.log(`\nBorrados ${result.count} clientes (y sus tarjetas, sellos y canjes).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
