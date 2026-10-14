import type { CSSProperties } from 'react';

export interface CardPreviewData {
  programTitle: string;
  programSub: string;
  stampsLabel: string;
  progressText: string;
  stage: 'STAGE_1' | 'STAGE_2' | 'COMPLETED';
  circles: Array<{ key: string; label: string; filled: boolean; kind: 'stamp' | 'reward' }>;
}

interface Props {
  data: CardPreviewData;
  customerName?: string;
  /** URL of the card's QR image (/api/wallet/qr/...). When omitted the QR block is not rendered. */
  qrSrc?: string;
}

/**
 * The UFC GYM FUEL reward card as a real web component (styles: .rc-* in globals.css). It uses the
 * exact shaker artwork the Wallet passes use (public/card/*.png, copied from assets/apple-pass by
 * scripts/generate-shaker-icons.ts) — earned stamps bright, pending ones dimmed, reward in gold.
 */
export default function CardPreview({ data, customerName, qrSrc }: Props) {
  const stamps = data.circles.filter((c) => c.kind === 'stamp');
  const reward = data.circles.find((c) => c.kind === 'reward');
  const completed = data.stage === 'COMPLETED';
  const cols = Math.max(1, Math.ceil(stamps.length / 2));
  const style = { '--cols': cols, '--cup-h': stamps.length > 6 ? '54px' : '76px' } as CSSProperties;

  return (
    <section className="rc" aria-label="Tarjeta de recompensas UFC GYM FUEL" style={style}>
      <header className="rc-header">
        <img className="rc-logo" src="/card/logo.png" alt="UFC GYM FUEL" />
        <div className="rc-program">
          <span className="rc-program-label">PROGRAMA</span>
          <span className="rc-program-name">{data.programTitle}</span>
        </div>
      </header>

      {completed ? (
        <div className="rc-complete">¡CICLO COMPLETADO!</div>
      ) : (
        <div className="rc-progress">
          <ul className="rc-stamps" aria-label={`Sellos: ${data.stampsLabel}`}>
            {stamps.map((s, i) => (
              <li key={s.key}>
                <img
                  className="rc-cup"
                  src={s.filled ? '/card/shaker-filled.png' : '/card/shaker-empty.png'}
                  alt={`Sello ${i + 1}: ${s.filled ? 'obtenido' : 'pendiente'}`}
                />
              </li>
            ))}
          </ul>
          {reward && (
            <div className="rc-reward">
              <img
                className="rc-cup rc-cup-reward"
                src={reward.filled ? '/card/shaker-gold.png' : '/card/shaker-gold-dim.png'}
                alt={`Premio ${reward.label}: ${reward.filled ? 'disponible' : 'aún no disponible'}`}
              />
              <span className="rc-reward-label">{reward.label}</span>
            </div>
          )}
        </div>
      )}

      <dl className="rc-summary">
        <div>
          <dt>SELLOS</dt>
          <dd className="rc-stamps-value">{data.stampsLabel}</dd>
        </div>
        <div>
          <dt>ESTADO</dt>
          <dd>{data.progressText}</dd>
        </div>
        {customerName && (
          <div className="rc-client">
            <dt>CLIENTE</dt>
            <dd>{customerName}</dd>
          </div>
        )}
      </dl>

      {qrSrc && (
        <div className="rc-qr">
          <div className="rc-qr-box">
            <img src={qrSrc} alt="Código QR de tu tarjeta" width={176} height={176} />
            <span>Escanear en caja</span>
          </div>
        </div>
      )}
    </section>
  );
}
