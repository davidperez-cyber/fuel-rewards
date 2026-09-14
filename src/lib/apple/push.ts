import apn from 'apn';
import { prisma } from '@/lib/db';
import { loadAppleTlsCredentials } from './certs';

const globalForApn = globalThis as unknown as { appleApnProvider?: apn.Provider };

function getProvider(): apn.Provider {
  if (globalForApn.appleApnProvider) return globalForApn.appleApnProvider;

  const { cert, key, passphrase } = loadAppleTlsCredentials();
  const provider = new apn.Provider({
    cert,
    key,
    passphrase,
    production: process.env.NODE_ENV === 'production',
  });
  globalForApn.appleApnProvider = provider;
  return provider;
}

/**
 * Sends a silent "pass content changed" push to every device registered for this card,
 * per the PassKit Web Service flow: the notification carries no payload, it just tells
 * the device to call GET /v1/passes/{passTypeIdentifier}/{serialNumber} again.
 */
export async function pushAppleUpdate(cardId: string): Promise<void> {
  const registrations = await prisma.appleDeviceRegistration.findMany({ where: { cardId } });
  if (registrations.length === 0) return;

  const passTypeIdentifier = process.env.APPLE_PASS_TYPE_IDENTIFIER;
  if (!passTypeIdentifier) throw new Error('Missing APPLE_PASS_TYPE_IDENTIFIER env var.');

  const provider = getProvider();
  const notification = new apn.Notification();
  notification.topic = passTypeIdentifier;
  notification.payload = {}; // Wallet pass updates use an empty payload by spec.

  const tokens = registrations.map((r) => r.pushToken);
  const result = await provider.send(notification, tokens);

  const staleTokens = new Set<string>();
  for (const failure of result.failed) {
    if (failure.status === '410' || failure.response?.reason === 'BadDeviceToken' || failure.response?.reason === 'Unregistered') {
      staleTokens.add(failure.device);
    } else {
      console.error('APNs push failed for device', failure.device, failure.status, failure.response);
    }
  }
  if (staleTokens.size > 0) {
    await prisma.appleDeviceRegistration.deleteMany({
      where: { cardId, pushToken: { in: Array.from(staleTokens) } },
    });
  }
}
