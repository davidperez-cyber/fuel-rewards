import { getGoogleWalletClient } from './client';

/**
 * Creates the single shared Loyalty Class for the FUEL program if it doesn't exist yet.
 * Safe to call repeatedly (idempotent — a 409 CONFLICT from Google means it already exists).
 * Run via `npm run google:setup-class` once, or it's called lazily before the first object sync.
 */
export async function ensureLoyaltyClass(): Promise<void> {
  const client = getGoogleWalletClient();
  if (!client) return;

  const classResource: Record<string, unknown> = {
    id: client.classId,
    issuerName: 'UFC GYM',
    programName: 'FUEL Rewards',
    programLogo: {
      sourceUri: {
        uri: 'https://raw.githubusercontent.com/', // placeholder — replace with a hosted UFC GYM FUEL logo URL before launch
      },
      contentDescription: { defaultValue: { language: 'es-MX', value: 'UFC GYM FUEL' } },
    },
    reviewStatus: 'UNDER_REVIEW',
    hexBackgroundColor: '#0b0b0c',
    countryCode: 'MX',
  };

  try {
    await client.walletobjects.loyaltyclass.insert({ requestBody: classResource });
    console.log(`Google Wallet loyalty class created: ${client.classId}`);
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code;
    if (code === 409) return; // already exists
    console.error('Failed to create Google Wallet loyalty class', err);
    throw err;
  }
}
