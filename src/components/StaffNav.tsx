'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface Me {
  id: string;
  name: string;
  role: 'STAFF' | 'ADMIN';
}

export default function StaffNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => setMe(data.user))
      .catch(() => setMe(null));
  }, [pathname]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setMe(null);
    router.push('/login');
  }

  const tabs = [
    { href: '/staff', label: 'Staff', show: true },
    { href: '/admin', label: 'Admin', show: me?.role === 'ADMIN' },
  ].filter((t) => t.show);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        borderBottom: '1px solid var(--border)',
        flexWrap: 'wrap',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="font-display" style={{ fontSize: 20 }}>UFC GYM</span>
        <span style={{ width: 1, height: 20, background: '#3a3a3a' }} />
        <span className="font-display" style={{ fontSize: 20, color: 'var(--red)' }}>FUEL</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 6 }}>Panel interno</span>
      </div>
      {me && (
        <div style={{ display: 'flex', gap: 4, background: '#161616', padding: 4, borderRadius: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {tabs.map((tab) => {
            const active = pathname?.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  background: active ? 'var(--red)' : 'transparent',
                  color: active ? '#fff' : 'var(--text-muted)',
                }}
              >
                {tab.label}
              </Link>
            );
          })}
          <button
            onClick={logout}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', padding: '8px 12px' }}
          >
            {me.name} · Salir
          </button>
        </div>
      )}
    </div>
  );
}
