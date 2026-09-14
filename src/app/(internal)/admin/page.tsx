'use client';

import { useEffect, useState, useCallback } from 'react';

interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  card: {
    stampsLabel: string;
    stage: 'STAGE_1' | 'STAGE_2' | 'COMPLETED';
    rewardReady: boolean;
  };
}

interface Stats {
  total: number;
  pending: number;
  claimed: number;
}

export default function AdminPage() {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  const load = useCallback(async (q: string) => {
    const [customersRes, statsRes] = await Promise.all([
      fetch(`/api/customers?q=${encodeURIComponent(q)}`),
      fetch('/api/admin/stats'),
    ]);
    if (customersRes.ok) setRows(await customersRes.json());
    if (statsRes.ok) setStats(await statsRes.json());
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(query), 250);
    return () => clearTimeout(t);
  }, [query, load]);

  function badge(row: CustomerRow): { text: string; bg: string; color: string } {
    if (row.card.stage === 'COMPLETED') return { text: 'Ciclo completo', bg: '#232323', color: '#9a9a9a' };
    if (row.card.rewardReady) return { text: 'Premio disponible', bg: 'var(--gold)', color: '#141414' };
    return { text: 'En progreso', bg: '#232323', color: '#cfcfcf' };
  }

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        <StatCard label="CLIENTES REGISTRADOS" value={stats?.total ?? '—'} />
        <StatCard label="PREMIOS POR CANJEAR" value={stats?.pending ?? '—'} color="var(--gold)" />
        <StatCard label="PREMIOS CANJEADOS" value={stats?.claimed ?? '—'} color="var(--red)" />
      </div>

      <input
        className="input"
        style={{ maxWidth: 320 }}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar cliente"
      />

      <div className="panel" style={{ overflowX: 'auto' }}>
        <table style={{ minWidth: 560 }}>
          <thead>
            <tr>
              <th>NOMBRE</th>
              <th>TELÉFONO</th>
              <th>CORREO</th>
              <th>SELLOS</th>
              <th>ESTADO</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const b = badge(r);
              return (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td style={{ color: '#cfcfcf' }}>{r.phone}</td>
                  <td style={{ color: '#cfcfcf' }}>{r.email || '—'}</td>
                  <td style={{ color: '#cfcfcf' }}>{r.card.stampsLabel}</td>
                  <td>
                    <span style={{ background: b.bg, color: b.color, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                      {b.text}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="panel" style={{ padding: 18 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em' }}>{label}</div>
      <div className="font-display" style={{ fontSize: 28, marginTop: 6, color: color || '#fff' }}>{value}</div>
    </div>
  );
}
