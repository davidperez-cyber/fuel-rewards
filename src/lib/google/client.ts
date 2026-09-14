import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import type { walletobjects_v1 } from 'googleapis';

export interface GoogleWalletClient {
  walletobjects: walletobjects_v1.Walletobjects;
  serviceAccountEmail: string;
  privateKey: string;
  issuerId: string;
  classId: string; // fully-qualified "<issuerId>.<GOOGLE_WALLET_CLASS_ID>"
}

let cached: GoogleWalletClient | null | undefined;

/**
 * Returns null (instead of throwing) when Google Wallet credentials aren't configured yet,
 * so the rest of the app can keep working with Apple Wallet only until they're provided.
 */
export function getGoogleWalletClient(): GoogleWalletClient | null {
  if (cached !== undefined) return cached;

  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID?.trim();
  const keyPath = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_PATH?.trim();
  const classSuffix = process.env.GOOGLE_WALLET_CLASS_ID?.trim() || 'fuel_rewards_class';

  if (!issuerId || !keyPath) {
    cached = null;
    return null;
  }

  const resolved = path.resolve(process.cwd(), keyPath);
  if (!fs.existsSync(resolved)) {
    console.warn(`Google Wallet service account file not found at ${resolved}; Google Wallet integration disabled.`);
    cached = null;
    return null;
  }

  const serviceAccount = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/wallet_object.issuer'],
  });

  const walletobjects = google.walletobjects({ version: 'v1', auth });

  cached = {
    walletobjects,
    serviceAccountEmail: serviceAccount.client_email,
    privateKey: serviceAccount.private_key,
    issuerId,
    classId: `${issuerId}.${classSuffix}`,
  };
  return cached;
}

export function isGoogleWalletConfigured(): boolean {
  return getGoogleWalletClient() !== null;
}
