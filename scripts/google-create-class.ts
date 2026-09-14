import 'dotenv/config';
import { ensureLoyaltyClass } from '../src/lib/google/classes';
import { isGoogleWalletConfigured } from '../src/lib/google/client';

async function main() {
  if (!isGoogleWalletConfigured()) {
    console.log(
      'Google Wallet no está configurado todavía (GOOGLE_WALLET_ISSUER_ID / GOOGLE_WALLET_SERVICE_ACCOUNT_PATH). Nada que hacer.',
    );
    return;
  }
  await ensureLoyaltyClass();
  console.log('Listo.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
