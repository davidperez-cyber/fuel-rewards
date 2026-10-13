import { SignJWT, importPKCS8 } from 'jose';
import { prisma } from '@/lib/db';
import { ApiError } from '@/lib/api/errors';
import { getCycleState } from '@/lib/loyalty/rules';
import { getGoogleWalletClient, isGoogleWalletConfigured } from './client';
import { ensureLoyaltyClass } from './classes';

function objectIdFor(client: NonNullable<ReturnType<typeof getGoogleWalletClient>>, serialNumber: string): string {
  return `${client.issuerId}.${serialNumber}`;
}

function publicBaseUrl(): string {
  return (process.env.APP_BASE_URL || '').replace(/\/$/, '');
}

function buildObjectResource(client: NonNullable<ReturnType<typeof getGoogleWalletClient>>, card: { serialNumber: string; authenticationToken: string; stamps: number; stage: string; cycleNumber: number; firstStampAt: Date | null; reward1ClaimedAt: Date | null; reward2ClaimedAt: Date | null }, customer: { id: string; name: string }) {
  const state = getCycleState(card as Parameters<typeof getCycleState>[0]);
  // `v` changes whenever progress changes, so Google refetches the strip image instead of serving its cached copy.
  const version = `${card.cycleNumber}-${card.stage}-${card.stamps}-${card.reward1ClaimedAt ? 1 : 0}${card.reward2ClaimedAt ? 1 : 0}`;
  const heroUrl = `${publicBaseUrl()}/api/wallet/strip/${card.serialNumber}?t=${card.authenticationToken}&v=${version}`;
  return {
    id: objectIdFor(client, card.serialNumber),
    classId: client.classId,
    state: 'ACTIVE',
    accountId: customer.id,
    accountName: customer.name,
    loyaltyPoints: {
      label: 'Sellos',
      balance: { string: state.stampsLabel },
    },
    barcode: {
      type: 'QR_CODE',
      value: card.serialNumber,
      alternateText: card.serialNumber,
    },
    textModulesData: [{ header: state.programTitle, body: state.progressText, id: 'status' }],
    // Only attach the hero image when the app is reachable over public HTTPS (Google must fetch it).
    ...(heroUrl.startsWith('https://')
      ? { heroImage: { sourceUri: { uri: heroUrl }, contentDescription: { defaultValue: { language: 'es-MX', value: 'Progreso de sellos' } } } }
      : {}),
  };
}

/** Creates or updates the customer's Loyalty Object to reflect their current stamps/stage. No-op if Google Wallet isn't configured yet. */
export async function syncGoogleObject(cardId: string): Promise<void> {
  const client = getGoogleWalletClient();
  if (!client) return;

  const card = await prisma.loyaltyCard.findUnique({ where: { id: cardId }, include: { customer: true } });
  if (!card || !card.customer) return;

  await ensureLoyaltyClass();

  const resource = buildObjectResource(client, card, card.customer);
  try {
    await client.walletobjects.loyaltyobject.patch({ resourceId: resource.id, requestBody: resource });
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code;
    if (code === 404) {
      await client.walletobjects.loyaltyobject.insert({ requestBody: resource });
    } else {
      throw err;
    }
  }

  if (card.googleObjectId !== resource.id) {
    await prisma.loyaltyCard.update({ where: { id: card.id }, data: { googleObjectId: resource.id } });
  }
}

/** Builds the "Add to Google Wallet" save URL (a JWT signed with the issuer's service account key). */
export async function generateGoogleSaveLink(cardId: string): Promise<string> {
  const client = getGoogleWalletClient();
  if (!client) {
    throw new ApiError(503, 'GOOGLE_WALLET_NOT_CONFIGURED', 'Google Wallet aún no está configurado (falta GOOGLE_WALLET_ISSUER_ID / service account).');
  }

  const card = await prisma.loyaltyCard.findUnique({ where: { id: cardId }, include: { customer: true } });
  if (!card || !card.customer) throw new ApiError(404, 'CARD_NOT_FOUND', 'Tarjeta no encontrada.');

  await syncGoogleObject(cardId);
  const objectId = objectIdFor(client, card.serialNumber);

  const key = await importPKCS8(client.privateKey, 'RS256');
  // Claim layout per Google's "Save to Google Wallet" JWT spec: `typ` is a *claim* here (not the
  // header, not `sub`), alongside aud/iss/iat/origins/payload. Getting this wrong makes
  // pay.google.com show a generic "error" page.
  const jwt = await new SignJWT({
    typ: 'savetowallet',
    origins: [publicBaseUrl()],
    payload: { loyaltyObjects: [{ id: objectId }] },
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuedAt()
    .setIssuer(client.serviceAccountEmail)
    .setAudience('google')
    .sign(key);

  return `https://pay.google.com/gp/v/save/${jwt}`;
}

export { isGoogleWalletConfigured };
