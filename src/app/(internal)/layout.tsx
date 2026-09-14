import StaffNav from '@/components/StaffNav';

/**
 * Layout for the internal tool (login, staff, admin). Never linked from the customer-facing
 * surface — reachable only by whoever has the URL (gym staff), and /staff, /admin are further
 * gated by middleware.ts.
 */
export default function InternalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh' }}>
      <StaffNav />
      {children}
    </div>
  );
}
