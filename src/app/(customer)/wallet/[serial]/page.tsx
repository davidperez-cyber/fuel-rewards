import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCycleState, buildCircles, stampWindowDays } from '@/lib/loyalty/rules';
import { isGoogleWalletConfigured } from '@/lib/google/client';
import CardPreview from '@/components/CardPreview';

export default async function WalletCardPage({
  params,
  searchParams,
}: {
  params: { serial: string };
  searchParams: { t?: string };
}) {
  const card = await prisma.loyaltyCard.findUnique({ where: { serialNumber: params.serial }, include: { customer: true } });
  if (!card || !card.customer || !searchParams.t || searchParams.t !== card.authenticationToken) {
    notFound();
  }

  const state = getCycleState(card);
  const circles = buildCircles(card);
  const appleUrl = `/api/wallet/apple/${card.serialNumber}?t=${card.authenticationToken}`;
  const googleUrl = `/api/wallet/google/${card.serialNumber}?t=${card.authenticationToken}`;

  return (
    <div className="container" style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
      <div style={{ flex: '0 0 320px', maxWidth: '100%' }}>
        <div style={{ background: '#000', borderRadius: 36, padding: 14, boxShadow: '0 30px 60px -20px rgba(0,0,0,0.6)' }}>
          <div style={{ background: '#000', borderRadius: 26, overflow: 'hidden', padding: '20px 16px 26px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#fff', padding: '0 6px 20px', fontWeight: 600 }}>
              <span>{new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
              <span style={{ letterSpacing: 2 }}>••••</span>
            </div>
            <CardPreview
              data={{
                programTitle: state.programTitle,
                programSub: state.programSub,
                stampsLabel: state.stampsLabel,
                progressText: state.progressText,
                stage: state.stage,
                circles,
              }}
            />
            <div style={{ marginTop: -14, height: 36, background: '#1c1c1e', borderRadius: '16px 16px 0 0', opacity: 0.5 }} />
          </div>
        </div>
      </div>
      <div style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 4 }}>
        <h1 className="font-display" style={{ fontSize: 28, margin: 0 }}>Tu tarjeta de recompensas</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6, margin: 0, maxWidth: 480 }}>
          Esta es tu tarjeta en Apple Wallet / Google Wallet. Se actualiza sola cada vez que el staff registra un sello en
          caja.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <InfoLine>Compra 6 Protein Shakes y el 7° es gratis.</InfoLine>
          <InfoLine>Al completar 15 shakes, recibe 1 shaker de regalo.</InfoLine>
          <InfoLine>
            Un sello por cada Protein Shake pagado. El shake de cortesía no acumula sello. Válido durante los primeros{' '}
            {stampWindowDays()} días desde tu primer sello.
          </InfoLine>
          {state.isExpired && (
            <InfoLine>Tus sellos vencieron. Pide al staff que reinicie tu ciclo en tu próxima visita.</InfoLine>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingTop: 6 }}>
          <a className="btn btn-light" href={appleUrl}>+ Apple Wallet</a>
          {isGoogleWalletConfigured() ? (
            <a className="btn btn-light" href={googleUrl}>+ Google Wallet</a>
          ) : (
            <button className="btn" disabled title="Google Wallet aún no está configurado">+ Google Wallet</button>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', maxWidth: 420 }}>
          Guarda este enlace — es tu acceso directo a tu tarjeta. Si cambias de teléfono, puedes volver a agregarla desde
          aquí.
        </div>
      </div>
    </div>
  );
}

function InfoLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="panel" style={{ padding: '14px 16px', fontSize: 13, color: '#cfcfcf' }}>
      {children}
    </div>
  );
}
