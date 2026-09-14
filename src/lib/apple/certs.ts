import fs from 'fs';
import path from 'path';
import forge from 'node-forge';

export interface AppleCerts {
  certPem: string;
  keyPem: string;
  wwdrPem: string;
  certificate: forge.pki.Certificate;
  wwdrCertificate: forge.pki.Certificate;
  // node-forge's own type defs disagree between pki.PrivateKey and pki.decryptRsaPrivateKey()'s
  // return type — `any` here avoids fighting that mismatch instead of misrepresenting either.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  privateKey: any;
}

let cached: AppleCerts | null = null;

function readFileFromEnv(envVar: string): string {
  const p = process.env[envVar];
  if (!p) throw new Error(`Missing env var ${envVar} for Apple Wallet certificates.`);
  const resolved = path.resolve(process.cwd(), p);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Apple Wallet file not found for ${envVar}: ${resolved}`);
  }
  return fs.readFileSync(resolved, 'utf8');
}

export function loadAppleCerts(): AppleCerts {
  if (cached) return cached;

  const certPem = readFileFromEnv('APPLE_PASS_CERT_PATH');
  let keyPem = readFileFromEnv('APPLE_PASS_KEY_PATH');
  const wwdrPem = readFileFromEnv('APPLE_WWDR_CERT_PATH');
  const passphrase = process.env.APPLE_PASS_KEY_PASSPHRASE || undefined;

  const certificate = forge.pki.certificateFromPem(certPem);
  const wwdrCertificate = forge.pki.certificateFromPem(wwdrPem);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let privateKey: any;
  if (passphrase) {
    privateKey = forge.pki.decryptRsaPrivateKey(keyPem, passphrase);
    if (!privateKey) throw new Error('Failed to decrypt Apple Pass private key with the provided passphrase.');
  } else {
    privateKey = forge.pki.privateKeyFromPem(keyPem);
  }

  cached = { certPem, keyPem, wwdrPem, certificate, wwdrCertificate, privateKey };
  return cached;
}

/** Returns cert/key in PEM form, suitable for TLS-based APNs (node's `tls`/`apn` expect PEM strings/buffers). */
export function loadAppleTlsCredentials(): { cert: string; key: string; passphrase?: string } {
  const certPem = readFileFromEnv('APPLE_PASS_CERT_PATH');
  const keyPem = readFileFromEnv('APPLE_PASS_KEY_PATH');
  const passphrase = process.env.APPLE_PASS_KEY_PASSPHRASE || undefined;
  return { cert: certPem, key: keyPem, passphrase };
}
