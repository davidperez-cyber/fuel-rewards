'use client';

import { useCallback, useEffect, useState } from 'react';

type Role = 'STAFF' | 'ADMIN';

interface StaffRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  stamps: number;
  createdAt: string;
}

/** Readable random password (no 0/O/1/l look-alikes), 14 characters. */
function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

const ROLE_TEXT: Record<Role, string> = { STAFF: 'Staff (solo da sellos y canjea)', ADMIN: 'Admin (acceso total)' };

export default function TeamPage() {
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [meId, setMeId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('STAFF');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  // After creating an account / changing a password, the password stays visible here so it can be copied once.
  const [shown, setShown] = useState<{ email: string; password: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/staff');
    if (res.ok) setRows(await res.json());
  }, []);

  useEffect(() => {
    load();
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => setMeId(d.user?.id ?? null))
      .catch(() => setMeId(null));
  }, [load]);

  async function call(url: string, method: string, body?: unknown): Promise<boolean> {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.issues?.[0]?.message || data?.error?.message || 'No se pudo completar.');
      setRows(data);
      return true;
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : 'No se pudo completar.', error: true });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    const pw = password;
    const mail = email.trim().toLowerCase();
    if (await call('/api/admin/staff', 'POST', { name, email: mail, role, password: pw })) {
      setShown({ email: mail, password: pw });
      setNotice({ text: `Cuenta creada: ${mail}`, error: false });
      setName('');
      setEmail('');
      setPassword('');
      setRole('STAFF');
    }
  }

  async function resetPassword(row: StaffRow) {
    if (!window.confirm(`¿Generar una contraseña nueva para ${row.email}? La anterior dejará de funcionar.`)) return;
    const pw = generatePassword();
    if (await call(`/api/admin/staff/${row.id}`, 'PATCH', { password: pw })) {
      setShown({ email: row.email, password: pw });
      setNotice({ text: `Contraseña cambiada: ${row.email}`, error: false });
    }
  }

  async function toggleRole(row: StaffRow) {
    const next: Role = row.role === 'ADMIN' ? 'STAFF' : 'ADMIN';
    if (!window.confirm(`¿Cambiar a ${row.email} a ${ROLE_TEXT[next]}?`)) return;
    if (await call(`/api/admin/staff/${row.id}`, 'PATCH', { role: next })) {
      setNotice({ text: `${row.email} ahora es ${next === 'ADMIN' ? 'Admin' : 'Staff'}.`, error: false });
    }
  }

  async function remove(row: StaffRow) {
    if (!window.confirm(`¿Borrar la cuenta ${row.email}? Ya no podrá entrar. Los sellos que dio se quedan en el historial.`)) return;
    if (await call(`/api/admin/staff/${row.id}`, 'DELETE')) {
      setNotice({ text: `Cuenta borrada: ${row.email}`, error: false });
      if (shown?.email === row.email) setShown(null);
    }
  }

  const label: React.CSSProperties = { fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em' };
  const canCreate = name.trim().length >= 2 && /^\S+@\S+\.\S+$/.test(email.trim()) && password.length >= 10;

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <div className="font-display" style={{ fontSize: 22 }}>Equipo</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Cuentas para entrar al panel. <b>Staff</b> solo ve la pantalla de Staff (buscar, escanear, dar sellos y canjear). <b>Admin</b> ve todo.
        </div>
      </div>

      <div className="panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 }}>
        <div style={label}>NUEVA CUENTA</div>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre (ej. Caja FUEL)" />
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo (será su usuario)" autoComplete="off" />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['STAFF', 'ADMIN'] as Role[]).map((r) => (
            <button key={r} className={role === r ? 'btn btn-primary' : 'btn btn-outline'} onClick={() => setRole(r)}>
              {ROLE_TEXT[r]}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            style={{ flex: 1, fontFamily: 'monospace' }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña (mínimo 10 caracteres)"
            autoComplete="new-password"
          />
          <button className="btn btn-outline" onClick={() => setPassword(generatePassword())}>
            Generar
          </button>
        </div>
        <button className="btn btn-primary" disabled={busy || !canCreate} onClick={create}>
          Crear cuenta
        </button>
      </div>

      {notice && <div style={{ fontSize: 14, fontWeight: 700, color: notice.error ? 'var(--red)' : '#4cc27a' }}>{notice.text}</div>}

      {shown && (
        <div className="panel" style={{ padding: 16, borderColor: 'var(--gold)', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 700 }}>Datos de acceso: cópialos ahora, la contraseña no se vuelve a mostrar.</div>
          <div style={{ fontSize: 14 }}>
            Usuario: <b>{shown.email}</b>
          </div>
          <div style={{ fontSize: 14 }}>
            Contraseña: <b style={{ fontFamily: 'monospace', fontSize: 16 }}>{shown.password}</b>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-outline"
              onClick={() => navigator.clipboard?.writeText(`Usuario: ${shown.email}\nContraseña: ${shown.password}`)}
            >
              Copiar
            </button>
            <button className="btn btn-outline" onClick={() => setShown(null)}>
              Ocultar
            </button>
          </div>
        </div>
      )}

      <div className="panel" style={{ overflowX: 'auto' }}>
        <table style={{ minWidth: 620 }}>
          <thead>
            <tr>
              <th>NOMBRE</th>
              <th>CORREO</th>
              <th>ROL</th>
              <th>SELLOS DADOS</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>
                  {r.name}
                  {r.id === meId && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> (tú)</span>}
                </td>
                <td style={{ color: '#cfcfcf' }}>{r.email}</td>
                <td>
                  <span
                    style={{
                      background: r.role === 'ADMIN' ? 'var(--red)' : '#232323',
                      color: '#fff',
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {r.role === 'ADMIN' ? 'Admin' : 'Staff'}
                  </span>
                </td>
                <td style={{ color: '#cfcfcf' }}>{r.stamps}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button className="btn btn-outline" style={{ padding: '6px 10px', fontSize: 12 }} disabled={busy} onClick={() => resetPassword(r)}>
                      Nueva contraseña
                    </button>
                    {r.id !== meId && (
                      <>
                        <button className="btn btn-outline" style={{ padding: '6px 10px', fontSize: 12 }} disabled={busy} onClick={() => toggleRole(r)}>
                          {r.role === 'ADMIN' ? 'Hacer Staff' : 'Hacer Admin'}
                        </button>
                        <button className="btn btn-outline" style={{ padding: '6px 10px', fontSize: 12, color: 'var(--red)' }} disabled={busy} onClick={() => remove(r)}>
                          Borrar
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
