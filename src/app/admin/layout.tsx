// 2026-05-16 PR #141 — admin 화이트리스트 가드 (서버 사이드 redirect).
// 모든 /admin/* 페이지에 적용. 비admin 접근 시 / 또는 /login 으로 리다이렉트.
// API 라우트는 자체 가드 (getCurrentAdminCheck) 가 401/403 응답.
import { redirect } from 'next/navigation';
import { getCurrentAdminCheck } from '@/lib/admin-auth';
import { createClient } from '@/lib/supabase/server';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const guard = await getCurrentAdminCheck(supabase);
  if (!guard.ok) {
    if (guard.reason === 'unauthenticated') {
      redirect('/login?next=/admin');
    }
    // forbidden — 일반 사용자가 admin URL 직접 입력한 경우. 홈으로.
    redirect('/');
  }
  return <>{children}</>;
}
