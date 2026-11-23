'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import CardPreview from '@/components/CardPreview';
import QrScanModal from '@/components/QrScanModal';

interface CustomerCard {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  card: {
    serialNumber: string;
    stamps: number;
    stage: 'STAGE_1' | 'STAGE_2' | 'COMPLETED';
    stampsLabel: string;
    programTitle: string;
    programSub: string;
    progressText: string;
    rewardReady: boolean;
    rewardType: 'FREE_SHAKE' | 'SHAKER' | null;
    isExpired: boolean;
    circles: Array<{ key: string; label: string; filled: boolean; kind: 'stamp' | 'reward' }>;
  };
}

export default function StaffPage() {
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<CustomerCard[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  // Last customer stamped by a scan: guards against the same QR being read twice in a row.
  const lastScanRef = useRef<{ id: string; at: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);

  const load = useCallback(async (q: string) => {
    const res = await fetch(`/api/customers?q=${encodeURIComponent(q)}`);
    if (!res.ok) return;
    const data: CustomerCard[] = await res.json();
    setCustomers(data);
    setSelectedId((prev) => prev ?? data[0]?.id ?? null);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(query), 250);
    return () => clearTimeout(t);
  }, [query, load]);

  function showToast(msg: string, error = false) {
    setToast({ text: msg, error });
    setTimeout(() => setToast(null), error ? 5000 : 3500);
  }

  async function runAction(id: string, path: 'stamp' | 'redeem' | 'reset', successMsg: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/customers/${id}/${path}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Acción no disponible.');
      setCustomers((prev) => prev.map((c) => (c.id === id ? data : c)));
      showToast(successMsg);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error desconocido.', true);
    } finally {
      setBusy(false);
    }
  }

  async function handleScan(serial: string) {
    setScanning(false);
    try {
      const res = await fetch(`/api/customers/scan?serial=${encodeURIComponent(serial)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'No encontrado.');
      setCustomers((prev) => {
        const exists = prev.some((c) => c.id === data.id);
        return exists ? prev.map((c) => (c.id === data.id ? data : c)) : [data, ...prev];
      });
      setSelectedId(data.id);
      // On a phone the detail panel sits below the list: bring it into view.
      setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);

      // Scanning a card gives the stamp right away (the normal stamp rules still apply).
      const last = lastScanRef.current;
      if (last && last.id === data.id && Date.now() - last.at < 8000) {
        showToast(`${data.name}: ya se le dio un sello hace un momento.`, true);
        return;
      }
      setBusy(true);
      try {
        const stampRes = await fetch(`/api/customers/${data.id}/stamp`, { method: 'POST' });
        const stamped = await stampRes.json();
        if (!stampRes.ok) {
          showToast(`${data.name}: ${stamped?.error?.message || 'No se pudo dar el sello.'}`, true);
          return;
        }
        lastScanRef.current = { id: data.id, at: Date.now() };
        setCustomers((prev) => prev.map((c) => (c.id === stamped.id ? stamped : c)));
        showToast(`¡Sello agregado a ${data.name}! Lleva ${stamped.card.stampsLabel}`);
      } finally {
        setBusy(false);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Código no reconocido.', true);
    }
  }

  const selected = customers.find((c) => c.id === selectedId) || null;

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 220 }}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre o teléfono"
        />
        <button className="btn btn-primary" onClick={() => setScanning(true)}>
          Escanear QR y dar sello
        </button>
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 260px', maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {customers.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Sin resultados.</div>}
          {customers.map((c) => {
            const isSel = c.id === selectedId;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                style={{
                  textAlign: 'left',
                  background: isSel ? 'var(--red)' : 'var(--surface)',
                  border: `1px solid ${isSel ? 'var(--red)' : 'var(--border)'}`,
                  borderRadius: 10,
                  padding: '12px 14px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{c.name}</span>
                <span style={{ fontSize: 11, color: isSel ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)' }}>
                  {c.phone} · {c.card.stampsLabel} sellos
                </span>
              </button>
            );
          })}
        </div>

        <div ref={detailRef} className="panel" style={{ flex: '1 1 320px', minWidth: 0, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!selected ? (
            <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Selecciona un cliente de la lista.</div>
          ) : (
            <>
              <div>
                <div className="font-display" style={{ fontSize: 20 }}>{selected.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                  {selected.phone} {selected.email ? `· ${selected.email}` : ''}
                </div>
              </div>

              <div style={{ maxWidth: 420 }}>
                <CardPreview data={selected.card} customerName={selected.name} />
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn btn-light" disabled={busy} onClick={() => runAction(selected.id, 'stamp', 'Sello agregado.')}>
                  +1 sello
                </button>
                <button
                  className={selected.card.rewardReady ? 'btn btn-gold' : 'btn'}
                  disabled={busy || !selected.card.rewardReady}
                  onClick={() => runAction(selected.id, 'redeem', 'Premio canjeado.')}
                >
                  {selected.card.stage === 'STAGE_1' ? 'Canjear shake gratis' : selected.card.stage === 'STAGE_2' ? 'Canjear shaker' : 'Sin premio'}
                </button>
                {selected.card.stage === 'COMPLETED' && (
                  <button className="btn btn-outline" disabled={busy} onClick={() => runAction(selected.id, 'reset', 'Ciclo reiniciado.')}>
                    Reiniciar ciclo
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            left: 16,
            right: 16,
            bottom: 24,
            maxWidth: 440,
            margin: '0 auto',
            zIndex: 60,
            padding: '14px 16px',
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 700,
            textAlign: 'center',
            color: '#fff',
            background: toast.error ? 'var(--red)' : '#1f7a3f',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          }}
        >
          {toast.text}
        </div>
      )}

      {scanning && <QrScanModal onDetected={handleScan} onClose={() => setScanning(false)} />}
    </div>
  );
}
