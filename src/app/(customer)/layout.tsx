/**
 * Layout for everything a customer can reach (signup, their card page). Deliberately has
 * no links to /staff or /admin — those must never be discoverable from the customer-facing
 * surface, only typed directly by staff.
 */
export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="font-display" style={{ fontSize: 20 }}>UFC GYM</span>
          <span style={{ width: 1, height: 20, background: '#3a3a3a' }} />
          <span className="font-display" style={{ fontSize: 20, color: 'var(--red)' }}>FUEL</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 6 }}>Recompensas</span>
        </div>
      </div>
      {children}
    </div>
  );
}
