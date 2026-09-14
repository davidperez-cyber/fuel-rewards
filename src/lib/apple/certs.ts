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

/**
 * Reads a PEM secret two ways so the same code works in local dev and in a cloud deploy:
 * - `${name}_B64`: base64-encoded PEM content, set directly as a platform secret/env var
 *   (Vercel, Firebase Secret Manager, etc. — no filesystem access to a checked-in file needed).
 * - `${name}_PATH`: path to a local file (what local dev / secrets/apple/ uses).
 * The base64 form wins when both are present.
 */
function readSecret(name: string): string {
  const b64 = process.env[`${name}_B64`];
  if (b64) {
    return Buffer.from(b64, 'base64').toString('utf8');
  }

  const p = process.env[`${name}_PATH`];
  if (!p) {
    throw new Error(`Missing ${name}_B64 or ${name}_PATH env var for Apple Wallet certificates.`);
  }
  const resolved = path.resolve(process.cwd(), p);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Apple Wallet file not found for ${name}_PATH: ${resolved}`);
  }
  return fs.readFileSync(resolved, 'utf8');
}

export function loadAppleCerts(): AppleCerts {
  if (cached) return cached;

  const certPem = readSecret('APPLE_PASS_CERT');
  const keyPem = readSecret('APPLE_PASS_KEY');
  const wwdrPem = readSecret('APPLE_WWDR_CERT');
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
  const certPem = readSecret('APPLE_PASS_CERT');
  const keyPem = readSecret('APPLE_PASS_KEY');
  const passphrase = process.env.APPLE_PASS_KEY_PASSPHRASE || undefined;
  return { cert: certPem, key: keyPem, passphrase };
}
