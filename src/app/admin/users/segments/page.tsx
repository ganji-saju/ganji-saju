import type { Metadata } from 'next';
import Link from 'next/link';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { fetchSegmentCounts, fetchCohortRetention } from '@/lib/admin/segments-data';

export const metadata: Metadata = {
  title: '세그먼트·코호트 (admin)',
  description: '가입자 세그먼트 인원과 코호트 잔존율',
  robots: { index: false, follow: false },
};

function pct(v: number | null): string {
  return v == null ? '—' : `${Math.round(v * 100)}%`;
}
function fmtWon(won: number): string {
  return `₩${won.toLocaleString('ko-KR')}`;
}

export default async function AdminSegmentsPage() {
  const supabase = await createClient();
  await getCurrentAdminRole(supabase); // /admin 레이아웃이 1차 가드

  const nowIso = new Date().toISOString();
  const [counts, cohorts] = await Promise.all([fetchSegmentCounts(), fetchCohortRetention(nowIso)]);

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="세그먼트·코호트 (admin)" backHref="/admin/users" />

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {counts.map(({ segment, count }) => (
            <Link
              key={segment.key}
              href={`/admin/users?${segment.query}`}
              className="rounded-[14px] border border-[var(--app-line)] bg-white p-4 hover:bg-[var(--app-pink-soft)]"
            >
              <div className="text-[12px] text-[var(--app-copy-soft)]">{segment.label}</div>
              <div className="text-[22px] font-extrabold text-[var(--app-ink)]">{count.toLocaleString('ko-KR')}</div>
              <div className="mt-1 text-[11px] text-[var(--app-copy-soft)]">{segment.description}</div>
            </Link>
          ))}
        </section>

        <section className="rounded-[14px] border border-[var(--app-line)] bg-white p-4">
          <h2 className="text-[13px] font-extrabold text-[var(--app-ink)]">가입 코호트 잔존율</h2>
          <p className="mt-1 text-[11px] text-[var(--app-copy-soft)]">
            DN = 가입 후 N일 이상 활동 유지 비율(프록시). 성숙 코호트만 표시, 그 외 —. 표본 적을 땐 참고치.
          </p>
          {cohorts.length === 0 ? (
            <p className="mt-3 text-[12px] text-[var(--app-copy-soft)]">데이터가 없습니다.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left text-[var(--app-copy-soft)]">
                    <th className="py-1">가입월</th><th>인원</th><th>평균 LTV</th><th>D7</th><th>D30</th>
                  </tr>
                </thead>
                <tbody>
                  {cohorts.map((c) => (
                    <tr key={c.cohort} className="border-t border-[var(--app-line)]">
                      <td className="py-2 font-bold">{c.cohort}</td>
                      <td>{c.size}</td>
                      <td>{fmtWon(c.avgLtvWon)}</td>
                      <td>{pct(c.d7)}</td>
                      <td>{pct(c.d30)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </AppPage>
    </AppShell>
  );
}
