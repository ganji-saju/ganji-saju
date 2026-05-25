// 2026-05-25 Phase 1 — 어드민 사용자 조회(검색·목록).
//   이메일 부분일치(auth.admin.listUsers 첫 200명 내) 또는 UUID 정확일치 → /admin/users/[id] 링크.
//   /admin 레이아웃이 화이트리스트 가드 수행(미인증/비admin redirect).
import type { Metadata } from 'next';
import Link from 'next/link';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { searchAdminUsers } from '@/lib/admin/user-detail';

export const metadata: Metadata = {
  title: '사용자 조회 (admin)',
  description: '이메일·UUID로 사용자 검색',
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<{ q?: string }>;
}

function fmtDate(iso: string): string {
  return typeof iso === 'string' ? iso.slice(0, 10) : '';
}

export default async function AdminUsersPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = (q ?? '').trim();
  const results = query ? await searchAdminUsers(query) : [];

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="사용자 조회 (admin)" backHref="/admin/operations" />

        <form
          method="get"
          className="rounded-[14px] border border-[var(--app-line)] bg-white p-4"
        >
          <label htmlFor="q" className="text-[13px] font-extrabold text-[var(--app-ink)]">
            이메일 또는 UUID
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="q"
              name="q"
              defaultValue={query}
              placeholder="kym@example.com 또는 UUID"
              className="flex-1 rounded-[10px] border border-[var(--app-line)] px-3 py-2 text-[13px] text-[var(--app-ink)]"
            />
            <button
              type="submit"
              className="rounded-[10px] bg-[var(--app-pink-strong)] px-4 py-2 text-[13px] font-extrabold text-white"
            >
              검색
            </button>
          </div>
          <p className="mt-1 text-[11px] text-[var(--app-copy-soft)]">
            이메일은 부분 일치(첫 200명 내), UUID는 정확 일치.
          </p>
        </form>

        <section className="rounded-[14px] border border-[var(--app-line)] bg-white p-4">
          <h2 className="text-[13px] font-extrabold text-[var(--app-ink)]">
            결과 {query ? `(${results.length})` : ''}
          </h2>
          {!query && (
            <p className="mt-2 text-[12px] text-[var(--app-copy-soft)]">검색어를 입력하세요.</p>
          )}
          {query && results.length === 0 && (
            <p className="mt-2 text-[12px] text-[var(--app-copy-soft)]">
              일치하는 사용자가 없습니다.
            </p>
          )}
          <ul className="mt-3 space-y-2">
            {results.map((u) => (
              <li key={u.id}>
                <Link
                  href={`/admin/users/${u.id}`}
                  className="flex flex-col gap-0.5 rounded-[12px] border border-[var(--app-line)] p-3 transition-colors hover:bg-[var(--app-pink-soft)]"
                >
                  <span className="text-[12.5px] font-extrabold text-[var(--app-ink)]">
                    {u.email ?? '(이메일 없음)'}
                  </span>
                  <span className="font-mono text-[11px] text-[var(--app-copy-soft)]">{u.id}</span>
                  <span className="text-[10.5px] text-[var(--app-copy-soft)]">
                    가입 {fmtDate(u.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </AppPage>
    </AppShell>
  );
}
