// 2026-05-16 PR #141 — admin 화이트리스트 가드 (서버 사이드 redirect).
// 모든 /admin/* 페이지에 적용. 비admin 접근 시 / 또는 /login 으로 리다이렉트.
// API 라우트는 자체 가드 (getCurrentAdminCheck) 가 401/403 응답.
// 2026-06-28 — 관리자 콘솔: 가드 통과 후 role 기반 영속 내비(AdminNav) 를 둘러싼다.
import { redirect } from 'next/navigation';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { createClient } from '@/lib/supabase/server';
import { AdminNav } from '@/components/admin/admin-nav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const guard = await getCurrentAdminRole(supabase);
  if (!guard.ok || !guard.role) {
    if (guard.reason === 'unauthenticated') {
      redirect('/login?next=/admin');
    }
    // forbidden — 일반 사용자가 admin URL 직접 입력한 경우. 홈으로.
    redirect('/');
  }
  return (
    <div className="flex min-h-dvh flex-col bg-[var(--app-bg)] md:flex-row">
      <AdminNav role={guard.role} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
