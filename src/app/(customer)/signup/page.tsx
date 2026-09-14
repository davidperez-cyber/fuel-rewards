'use client';

import { useEffect, useState } from 'react';
import CardPreview from '@/components/CardPreview';

interface RegisterResponse {
  id: string;
  name: string;
  card: {
    programTitle: string;
    programSub: string;
    stampsLabel: string;
    progressText: string;
    stage: 'STAGE_1' | 'STAGE_2' | 'COMPLETED';
    circles: Array<{ key: string; label: string; filled: boolean; kind: 'stamp' | 'reward' }>;
    cardUrl: string;
    appleWalletUrl: string;
    googleWalletUrl: string;
  };
}

export default function SignupPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RegisterResponse | null>(null);
  const [googleWalletEnabled, setGoogleWalletEnabled] = useState(false);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((d) => setGoogleWalletEnabled(!!d.googleWalletEnabled))
      .catch(() => setGoogleWalletEnabled(false));
  }, []);

  const disabled = !name.trim() || !phone.trim() || submitting;

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'No se pudo crear la tarjeta.');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido.');
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setName('');
    setPhone('');
    setEmail('');
    setResult(null);
    setError(null);
  }

  return (
    <div className="container" style={{ maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 className="font-display" style={{ fontSize: 26, margin: 0 }}>Obtén tu tarjeta FUEL</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
        Regístrate una vez y agrega tu tarjeta de recompensas al wallet de tu teléfono. Cada Protein Shake que compres suma un
        sello, sin apps ni contraseñas.
      </p>

      {result ? (
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center', padding: '28px 22px' }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--red)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700 }}>
            ✓
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="font-display" style={{ fontSize: 18 }}>¡Listo, {result.name}!</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Tu tarjeta está lista con 0 sellos.</div>
          </div>
          <div style={{ width: '100%' }}>
            <CardPreview data={result.card} showBarcode={false} />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <a className="btn btn-light" href={result.card.appleWalletUrl}>+ Apple Wallet</a>
            {googleWalletEnabled ? (
              <a className="btn btn-light" href={result.card.googleWalletUrl}>+ Google Wallet</a>
            ) : (
              <button className="btn" disabled title="Google Wallet aún no está configurado">+ Google Wallet</button>
            )}
            <a className="btn btn-outline" href={result.card.cardUrl}>Ver mi tarjeta</a>
          </div>
          <button onClick={reset} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
            Registrar otra persona
          </button>
        </div>
      ) : (
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 22 }}>
          <Field label="Nombre">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ana Torres" />
          </Field>
          <Field label="Teléfono">
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="55 1234 5678" />
          </Field>
          <Field label="Correo (opcional)">
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ana@correo.com" />
          </Field>
          {error && <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>}
          <button className="btn btn-primary" disabled={disabled} onClick={submit} style={{ marginTop: 6, padding: 13 }}>
            {submitting ? 'Creando...' : 'Crear mi tarjeta'}
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  );
}
