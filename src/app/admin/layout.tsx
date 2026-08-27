// 2026-05-16 PR #141 — admin 화이트리스트 가드 (서버 사이드 redirect).
// 모든 /admin/* 페이지에 적용. 비admin 접근 시 / 또는 /login 으로 리다이렉트.
// API 라우트는 자체 가드 (getCurrentAdminCheck) 가 401/403 응답.
// 2026-06-28 — 관리자 콘솔: 가드 통과 후 role 기반 영속 내비(AdminNav) 를 둘러싼다.
import { redirect } from 'next/navigation';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { createClient } from '@/lib/supabase/server';
import { AdminNav } from '@/components/admin/admin-nav';
import { AdminSectionTabs } from '@/components/admin/admin-section-tabs';

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
    <div className="admin-shell flex min-h-dvh flex-col bg-[var(--app-bg)] md:flex-row">
      <AdminNav role={guard.role} />
      {/* 2026-08-27 — 형제 화면 탭은 레이아웃 한 곳에서만 렌더한다. 페이지마다 붙이면
          어떤 화면엔 있고 어떤 화면엔 없는 상태가 조용히 생긴다. 부모가 없는 화면에서는
          컴포넌트가 스스로 null 을 돌려준다. */}
      <div className="min-w-0 flex-1">
        <AdminSectionTabs role={guard.role} />
        {children}
      </div>
    </div>
  );
}
