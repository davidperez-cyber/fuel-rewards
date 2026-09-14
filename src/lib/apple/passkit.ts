import crypto from 'crypto';
import forge from 'node-forge';
import JSZip from 'jszip';
import type { Customer, LoyaltyCard } from '@prisma/client';
import { getCycleState } from '@/lib/loyalty/rules';
import { loadAppleCerts } from './certs';
import { loadAppleAssetFiles } from './assets';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

/**
 * Apple rejects a pass outright (Wallet falls back to previewing it as a plain .zip) if
 * `webServiceURL` isn't HTTPS. `APP_BASE_URL` is `http://localhost:3000` in local dev, so we
 * omit the web service fields entirely rather than ship an invalid pass — the pass still
 * installs, it just won't receive push updates until this runs behind real HTTPS (a deploy,
 * or a tool like ngrok) and APP_BASE_URL is updated to match.
 */
function webServiceBaseUrl(): string | null {
  const base = requireEnv('APP_BASE_URL').replace(/\/$/, '');
  return base.startsWith('https://') ? `${base}/api/apple/passkit` : null;
}

/** Builds pass.json for a storeCard-style loyalty pass, per Apple's Wallet Passes reference. */
export function buildPassJson(card: LoyaltyCard, customer: Customer): Record<string, unknown> {
  const state = getCycleState(card);
  const passTypeIdentifier = requireEnv('APPLE_PASS_TYPE_IDENTIFIER');
  const teamIdentifier = requireEnv('APPLE_TEAM_ID');
  const organizationName = process.env.APPLE_ORGANIZATION_NAME || 'UFC GYM';

  const backFields: Array<Record<string, string>> = [
    {
      key: 'rules',
      label: 'Reglas del programa',
      value:
        'Compra 6 Protein Shakes y el 7° es gratis. Al completar 15 shakes, recibe 1 shaker de regalo. ' +
        'Un sello por cada Protein Shake pagado; el shake de cortesía no otorga sello.',
    },
    { key: 'member-name', label: 'Cliente', value: customer.name },
    { key: 'member-phone', label: 'Teléfono', value: customer.phone },
  ];
  if (state.expiresAt) {
    backFields.push({
      key: 'validity',
      label: 'Vigencia de sellos',
      value: `Válidos hasta ${state.expiresAt.toLocaleDateString('es-MX')}`,
    });
  }

  const webServiceURL = webServiceBaseUrl();

  return {
    formatVersion: 1,
    passTypeIdentifier,
    teamIdentifier,
    organizationName,
    serialNumber: card.serialNumber,
    description: 'UFC GYM FUEL — Tarjeta de recompensas',
    logoText: 'FUEL',
    backgroundColor: 'rgb(11,11,12)',
    foregroundColor: 'rgb(255,255,255)',
    labelColor: 'rgb(154,154,154)',
    // authenticationToken is only meaningful (and only valid per Apple's spec) alongside a real webServiceURL.
    ...(webServiceURL ? { webServiceURL, authenticationToken: card.authenticationToken } : {}),
    storeCard: {
      headerFields: [{ key: 'program', label: 'PROGRAMA', value: state.programTitle }],
      primaryFields: [{ key: 'stamps', label: 'SELLOS', value: state.stampsLabel }],
      secondaryFields: [
        { key: 'status', label: 'ESTADO', value: state.progressText },
      ],
      auxiliaryFields: [{ key: 'member', label: 'CLIENTE', value: customer.name }],
      backFields,
    },
    barcodes: [
      {
        format: 'PKBarcodeFormatQR',
        message: card.serialNumber,
        messageEncoding: 'iso-8859-1',
        altText: 'Escanear en caja',
      },
    ],
    // Legacy field required for iOS < 9 compatibility; harmless to include alongside `barcodes`.
    barcode: {
      format: 'PKBarcodeFormatQR',
      message: card.serialNumber,
      messageEncoding: 'iso-8859-1',
    },
  };
}

function sha1Hex(buf: Buffer): string {
  return crypto.createHash('sha1').update(buf).digest('hex');
}

function signManifest(manifestBuffer: Buffer): Buffer {
  const { certificate, wwdrCertificate, privateKey } = loadAppleCerts();

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifestBuffer.toString('binary'));
  p7.addCertificate(certificate);
  p7.addCertificate(wwdrCertificate);
  p7.addSigner({
    key: privateKey,
    certificate,
    digestAlgorithm: forge.pki.oids.sha256,
    // node-forge's type defs declare `value` as string-only, but the library itself special-cases
    // Date for signingTime at runtime — cast to bypass that overly narrow declaration.
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() as unknown as string },
    ],
  });
  p7.sign({ detached: true });

  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  return Buffer.from(der, 'binary');
}

export async function generatePkpassBuffer(card: LoyaltyCard, customer: Customer): Promise<Buffer> {
  const passJson = buildPassJson(card, customer);
  const passJsonBuffer = Buffer.from(JSON.stringify(passJson), 'utf8');
  const assets = loadAppleAssetFiles();

  const manifest: Record<string, string> = { 'pass.json': sha1Hex(passJsonBuffer) };
  for (const [filename, buf] of Object.entries(assets)) {
    manifest[filename] = sha1Hex(buf);
  }
  const manifestBuffer = Buffer.from(JSON.stringify(manifest), 'utf8');
  const signature = signManifest(manifestBuffer);

  const zip = new JSZip();
  zip.file('pass.json', passJsonBuffer);
  zip.file('manifest.json', manifestBuffer);
  zip.file('signature', signature);
  for (const [filename, buf] of Object.entries(assets)) {
    zip.file(filename, buf);
  }

  return zip.generateAsync({ type: 'nodebuffer', mimeType: 'application/vnd.apple.pkpass' });
}
