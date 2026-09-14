'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'No se pudo iniciar sesión.');
      router.push(searchParams.get('next') || '/staff');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 22 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Correo</label>
        <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Contraseña</label>
        <input
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </div>
      {error && <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>}
      <button className="btn btn-primary" disabled={submitting || !email || !password} onClick={submit} style={{ padding: 13 }}>
        {submitting ? 'Entrando...' : 'Entrar'}
      </button>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <h1 className="font-display" style={{ fontSize: 24, marginBottom: 20 }}>Iniciar sesión</h1>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
