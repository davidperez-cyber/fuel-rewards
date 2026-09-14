export interface CardPreviewData {
  programTitle: string;
  programSub: string;
  stampsLabel: string;
  progressText: string;
  stage: 'STAGE_1' | 'STAGE_2' | 'COMPLETED';
  circles: Array<{ key: string; label: string; filled: boolean; kind: 'stamp' | 'reward' }>;
}

function circleStyle(c: CardPreviewData['circles'][number]): React.CSSProperties {
  if (c.kind === 'reward') {
    return c.filled
      ? { background: 'var(--gold)', borderColor: 'var(--gold)', color: '#141414' }
      : { background: 'transparent', borderColor: 'var(--gold)', color: 'var(--gold)' };
  }
  return c.filled
    ? { background: 'var(--red)', borderColor: 'var(--red)', color: '#fff' }
    : { background: 'transparent', borderColor: '#3a3a3a', color: '#6a6a6a' };
}

export default function CardPreview({ data, showBarcode = true }: { data: CardPreviewData; showBarcode?: boolean }) {
  return (
    <div style={{ background: '#000', border: '1px solid #262626', borderRadius: 20, padding: '22px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span className="font-display" style={{ fontSize: 20 }}>UFC GYM</span>
        <span style={{ width: 1, height: 15, background: '#3a3a3a' }} />
        <span className="font-display" style={{ fontSize: 20, color: 'var(--red)' }}>FUEL</span>
      </div>
      <div>
        <div className="font-display" style={{ fontSize: 16 }}>{data.programTitle}</div>
        <div style={{ color: 'var(--red)', fontSize: 12, fontWeight: 700, marginTop: 4 }}>{data.programSub}</div>
      </div>
      {data.circles.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
          {data.circles.map((c) => (
            <div
              key={c.key}
              style={{
                aspectRatio: '1',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: c.kind === 'reward' ? 11 : 16,
                border: '2px solid',
                textAlign: 'center',
                lineHeight: 1,
                ...circleStyle(c),
              }}
            >
              {c.label}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderTop: '1px solid #262626', paddingTop: 14 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 700 }}>SELLOS</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{data.stampsLabel}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 700 }}>ESTADO</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: data.stage === 'COMPLETED' ? 'var(--text-dim)' : '#fff' }}>{data.progressText}</div>
        </div>
      </div>
      {showBarcode && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingTop: 6 }}>
          <div style={{ width: 110, height: 110, background: 'repeating-linear-gradient(45deg,#fff 0 4px,#000 4px 8px)', borderRadius: 8 }} />
          <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace', letterSpacing: '0.05em' }}>ESCANEAR EN CAJA</div>
        </div>
      )}
    </div>
  );
}
