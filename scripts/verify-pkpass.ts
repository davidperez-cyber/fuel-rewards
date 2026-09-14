import 'dotenv/config';
import fs from 'fs';
import { generatePkpassBuffer } from '../src/lib/apple/passkit';
import type { Customer, LoyaltyCard } from '@prisma/client';

/** Standalone sanity check: builds a signed .pkpass from fake data, without touching the database. */
async function main() {
  const card = {
    id: 'test-card',
    serialNumber: 'TESTSERIAL123',
    authenticationToken: 'test-auth-token',
    stamps: 3,
    stage: 'STAGE_1',
    reward1ClaimedAt: null,
    reward2ClaimedAt: null,
    firstStampAt: new Date(),
  } as unknown as LoyaltyCard;

  const customer = {
    id: 'test-customer',
    name: 'Ana Torres',
    phone: '55 1234 5678',
  } as unknown as Customer;

  const buf = await generatePkpassBuffer(card, customer);
  fs.writeFileSync('test.pkpass', buf);
  console.log('Wrote test.pkpass, size =', buf.length, 'bytes');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
