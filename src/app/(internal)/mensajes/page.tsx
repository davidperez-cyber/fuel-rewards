'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const MAX_LENGTH = 180;

type Kind = 'all' | 'frequent' | 'top';

interface AudienceRow {
  id: string;
  name: string;
  phone: string;
  purchases: number;
  recentPurchases: number | null;
  appleDevices: number;
  google: boolean;
}

interface Broadcast {
  id: string;
  message: string;
  audience: string;
  recipients: number;
  appleDevices: number;
  googleCards: number;
  sentBy: string | null;
  createdAt: string;
}

export default function MessagesPage() {
  const [kind, setKind] = useState<Kind>('frequent');
  const [minPurchases, setMinPurchases] = useState(4);
  const [days, setDays] = useState(30);
  const [limit, setLimit] = useState(20);

  const [rows, setRows] = useState<AudienceRow[]>([]);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [loadingAudience, setLoadingAudience] = useState(false);

  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [history, setHistory] = useState<Broadcast[]>([]);

  const audience = useMemo(() => {
    if (kind === 'all') return { kind } as const;
    if (kind === 'frequent') return { kind, minPurchases, days } as const;
    return { kind, limit } as const;
  }, [kind, minPurchases, days, limit]);

  const loadAudience = useCallback(async () => {
    setLoadingAudience(true);
    try {
      const res = await fetch('/api/admin/messages/audience', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(audience),
      });
      if (res.ok) {
        setRows(await res.json());
        setExcluded(new Set());
      }
    } finally {
      setLoadingAudience(false);
    }
  }, [audience]);

  const loadHistory = useCallback(async () => {
    const res = await fetch('/api/admin/messages');
    if (res.ok) setHistory(await res.json());
  }, []);

  useEffect(() => {
    const t = setTimeout(loadAudience, 300);
    return () => clearTimeout(t);
  }, [loadAudience]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const selected = rows.filter((r) => !excluded.has(r.id));
  const reachable = selected.filter((r) => r.appleDevices > 0 || r.google).length;

  function toggle(id: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function send() {
    const text = message.trim();
    if (text.length < 3 || selected.length === 0) return;
    const ok = window.confirm(
      `¿Enviar este mensaje a ${selected.length} cliente${selected.length === 1 ? '' : 's'}?\n\n"${text}"\n\nLes llegará como notificación de su tarjeta en Wallet.`,
    );
    if (!ok) return;
    setSending(true);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, audience, customerIds: selected.map((r) => r.id) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.issues?.[0]?.message || data?.error?.message || 'No se pudo enviar.');
      setNotice({
        text:
          `Enviado. iPhone: ${data.appleDevices} · Android: ${data.googleCards}` +
          (data.noWallet > 0 ? ` · ${data.noWallet} sin tarjeta en Wallet (no les llega)` : ''),
        error: false,
      });
      setMessage('');
      loadHistory();
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : 'No se pudo enviar.', error: true });
    } finally {
      setSending(false);
    }
  }

  const label: React.CSSProperties = { fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em' };
  const numInput: React.CSSProperties = { width: 80, textAlign: 'center' };

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <div className="font-display" style={{ fontSize: 22 }}>Mensajes a Wallet</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Escribe un aviso o promoción y les llega como notificación de su tarjeta UFC GYM FUEL en Apple Wallet y Google Wallet.
        </div>
      </div>

      <div className="panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={label}>1. A QUIÉN</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(
            [
              ['frequent', 'Clientes frecuentes'],
              ['top', 'Los que más compran'],
              ['all', 'Todos'],
            ] as Array<[Kind, string]>
          ).map(([k, text]) => (
            <button key={k} className={kind === k ? 'btn btn-primary' : 'btn btn-outline'} onClick={() => setKind(k)}>
              {text}
            </button>
          ))}
        </div>

        {kind === 'frequent' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 14 }}>
            Con al menos
            <input className="input" style={numInput} type="number" min={1} max={100} value={minPurchases} onChange={(e) => setMinPurchases(Math.max(1, Number(e.target.value) || 1))} />
            compras en los últimos
            <input className="input" style={numInput} type="number" min={1} max={365} value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))} />
            días
          </div>
        )}
        {kind === 'top' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 14 }}>
            Los
            <input className="input" style={numInput} type="number" min={1} max={1000} value={limit} onChange={(e) => setLimit(Math.max(1, Number(e.target.value) || 1))} />
            clientes con más compras
          </div>
        )}

        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {loadingAudience
            ? 'Buscando clientes…'
            : `${selected.length} cliente${selected.length === 1 ? '' : 's'} seleccionado${selected.length === 1 ? '' : 's'} · ${reachable} con tarjeta en Wallet`}
        </div>

        {rows.length > 0 && (
          <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: 36 }} />
                  <th>CLIENTE</th>
                  <th>COMPRAS</th>
                  <th>WALLET</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => toggle(r.id)} style={{ cursor: 'pointer', opacity: excluded.has(r.id) ? 0.45 : 1 }}>
                    <td>
                      <input type="checkbox" checked={!excluded.has(r.id)} onChange={() => toggle(r.id)} onClick={(e) => e.stopPropagation()} />
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.phone}</div>
                    </td>
                    <td style={{ color: '#cfcfcf' }}>
                      {r.purchases}
                      {r.recentPurchases !== null && (
                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}> ({r.recentPurchases} recientes)</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: r.appleDevices > 0 || r.google ? '#cfcfcf' : 'var(--text-dim)' }}>
                      {[r.appleDevices > 0 ? 'iPhone' : null, r.google ? 'Android' : null].filter(Boolean).join(' · ') || 'Sin Wallet'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={label}>2. MENSAJE</div>
        <textarea
          className="input"
          rows={3}
          maxLength={MAX_LENGTH}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ej. Este viernes 2x1 en Protein Shakes 🔥 Solo en UFC GYM FUEL."
          style={{ resize: 'vertical', fontFamily: 'inherit' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {message.trim().length}/{MAX_LENGTH} · Android entrega máximo ~3 notificaciones por cliente al día.
          </span>
          <button className="btn btn-primary" disabled={sending || message.trim().length < 3 || selected.length === 0} onClick={send}>
            {sending ? 'Enviando…' : `Enviar a ${selected.length} cliente${selected.length === 1 ? '' : 's'}`}
          </button>
        </div>
        {notice && (
          <div style={{ fontSize: 14, fontWeight: 700, color: notice.error ? 'var(--red)' : '#4cc27a' }}>{notice.text}</div>
        )}
      </div>

      <div className="panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={label}>ENVIADOS</div>
        {history.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Todavía no se ha enviado ningún mensaje.</div>
        ) : (
          history.map((h) => (
            <div key={h.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 14 }}>{h.message}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {new Date(h.createdAt).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })} · {h.audience} · {h.recipients} clientes · iPhone {h.appleDevices} · Android {h.googleCards}
                {h.sentBy ? ` · ${h.sentBy}` : ''}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
