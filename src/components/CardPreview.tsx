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

/** Parallelogram along the red streak of the bottom-right corner art (see DecoBottomRight). */
function streak(x1: number, x2: number): string {
  const slope = 1.106; // dy per dx of the streak
  const xAt = (xb: number, y: number) => xb + (382 - y) / slope;
  return `${xAt(x1, 500)},500 ${xAt(x2, 500)},500 ${xAt(x2, 0)},0 ${xAt(x1, 0)},0`;
}

/** Octagon-style corner art, top-left: gray planes with a thick red streak (outside the frame). */
function DecoTopLeft() {
  return (
    <svg className="rc-deco rc-deco-tl" viewBox="0 0 300 240" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="rc-g-tl" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2b2b2c" />
          <stop offset="1" stopColor="#111112" />
        </linearGradient>
      </defs>
      <polygon points="0,0 262,0 0,214" fill="url(#rc-g-tl)" />
      <polygon points="152,122 294,0 300,0 300,38 204,122" fill="#18181a" />
      <polygon points="112,122 254,0 292,0 150,122" fill="#e21c24" />
      <polygon points="0,216 36,186 42,194 0,228" fill="#e21c24" />
    </svg>
  );
}

/** Bottom-right corner art: big red streak with gray planes, crossing the frame's corner. */
function DecoBottomRight() {
  return (
    <svg className="rc-deco rc-deco-br" viewBox="0 0 340 500" aria-hidden="true" focusable="false">
      <defs>
        {/* gray planes fade out toward the left so they never end in a hard vertical edge */}
        <linearGradient id="rc-br-fade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0.12" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <mask id="rc-br-mask">
          <rect width="340" height="500" fill="url(#rc-br-fade)" />
        </mask>
      </defs>
      <g mask="url(#rc-br-mask)">
        <polygon points={streak(-190, -110)} fill="#161617" />
        <polygon points={streak(-60, 20)} fill="#1e1e1f" />
      </g>
      <polygon points={streak(100, 300)} fill="#171718" />
      <polygon points={streak(34, 80)} fill="#e21c24" />
      <polygon points="80,382 122,382 112,350 94,350" fill="#e21c24" />
    </svg>
  );
}

/** Octagon-cage mesh in the frame's bottom-left corner. */
function DecoCage() {
  return (
    <svg className="rc-cage" viewBox="0 0 280 330" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="rc-cage-fade" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="rc-cage-mask">
          <rect width="280" height="330" fill="url(#rc-cage-fade)" />
        </mask>
        <pattern id="rc-cage-mesh" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0H22M0 0V22" stroke="#555558" strokeWidth="1.4" fill="none" />
        </pattern>
        <clipPath id="rc-cage-clip">
          <polygon points="0,10 270,280 270,330 0,330" />
        </clipPath>
      </defs>
      <polygon points="0,10 270,280 270,330 0,330" fill="#161617" />
      <g clipPath="url(#rc-cage-clip)">
        <rect y="40" width="270" height="290" fill="url(#rc-cage-mesh)" mask="url(#rc-cage-mask)" />
      </g>
      <polygon points="0,10 270,280 270,306 0,36" fill="#262627" />
      <polygon points="270,280 280,290 280,330 270,330" fill="#202021" />
    </svg>
  );
}

/**
 * The UFC GYM FUEL reward card as a real web component (styles: .rc-* in globals.css). It uses the
 * exact shaker artwork and logo the Wallet passes use (public/card/*.png, generated from assets/ by
 * the scripts/generate-*.ts scripts) — earned stamps bright, pending ones dimmed, reward in gold.
 * The corner art (streaks, octagon mesh) is inline SVG, so nothing here is a background image.
 */
export default function CardPreview({ data, customerName, qrSrc }: Props) {
  const stamps = data.circles.filter((c) => c.kind === 'stamp');
  const reward = data.circles.find((c) => c.kind === 'reward');
  const completed = data.stage === 'COMPLETED';
  const cols = Math.max(1, Math.ceil(stamps.length / 2));
  const style = { '--cols': cols, '--cup-h': stamps.length > 6 ? '54px' : '76px' } as CSSProperties;

  return (
    <section className="rc" aria-label="Tarjeta de recompensas UFC GYM FUEL" style={style}>
      <DecoTopLeft />
      <div className="rc-frame">
        <DecoCage />
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
      </div>
      <DecoBottomRight />
    </section>
  );
}
