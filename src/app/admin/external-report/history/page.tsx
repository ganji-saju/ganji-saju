import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminPage } from '@/components/admin/admin-page';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { listExternalReports } from '@/lib/admin/external-report-history';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'PDF 생성 기록 (admin)',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function ExternalReportHistoryPage({ searchParams }: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const supabase = await createClient();
  const guard = await getCurrentAdminRole(supabase);
  if (!guard.ok || guard.role !== 'super_admin') redirect('/admin');

  const rawPage = (await searchParams).page;
  const requestedPage = typeof rawPage === 'string' && /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
  let history;
  try {
    history = await listExternalReports(requestedPage);
  } catch {
    return (
      <AdminPage title="PDF 생성 기록">
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          생성 기록을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.
        </p>
      </AdminPage>
    );
  }

  return (
    <AdminPage
      title="PDF 생성 기록"
      description="최근 생성한 순서로 20건씩 표시합니다. 저장된 풀이를 다시 열어 PDF로 내려받을 수 있습니다."
      actions={<Link href="/admin/external-report" className="rounded-md border border-[var(--app-line)] px-3 py-2 text-sm font-bold">새 PDF 생성</Link>}
    >
      <div className="overflow-x-auto rounded-lg border border-[var(--app-line)] bg-[var(--app-surface)]">
        <table className="w-full min-w-[900px] text-left text-sm text-[var(--app-ink)]">
          <caption className="sr-only">외부 주문 PDF 생성 내역</caption>
          <thead className="border-b border-[var(--app-line)] bg-[var(--app-bg)] text-xs text-[var(--app-copy-soft)]">
            <tr>
              <th scope="col" className="px-4 py-3">고객 · 보고서 번호</th>
              <th scope="col" className="px-4 py-3">사주 입력 정보</th>
              <th scope="col" className="px-4 py-3">출생지</th>
              <th scope="col" className="px-4 py-3">생성 날짜 (한국시간)</th>
              <th scope="col" className="px-4 py-3">PDF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--app-line)]">
            {history.items.map((item) => (
              <tr key={item.id}>
                <th scope="row" className="px-4 py-4 align-top font-normal">
                  <span className="font-bold">{item.subjectName}</span>
                  <span className="mt-1 block text-xs text-[var(--app-copy-soft)]">{item.reportNo}</span>
                  {item.generationSource === 'fallback' ? <span className="mt-1 block text-xs text-amber-800">기본 계산 풀이 · 내용 확인 필요</span> : null}
                </th>
                <td className="px-4 py-4 align-top">
                  <p>{item.birth.year}.{item.birth.month.padStart(2, '0')}.{item.birth.day.padStart(2, '0')} · {item.birth.calendarType === 'lunar' ? '음력 평달' : '양력'} · {item.birth.gender === 'male' ? '남성' : '여성'}</p>
                  <p className="mt-1 text-xs text-[var(--app-copy-soft)]">
                    {item.birth.unknownBirthTime ? '출생 시간 모름' : `${item.birth.hour.padStart(2, '0')}${item.birth.minute === '' ? '시 · 분 미입력' : `:${item.birth.minute.padStart(2, '0')}`} · ${({ standard: '표준시', trueSolarTime: '진태양시', nightZi: '야자시', earlyZi: '조자시' })[item.birth.timeRule]}`}
                  </p>
                </td>
                <td className="px-4 py-4 align-top">
                  {item.birth.birthLocationLabel || '입력 안 함'}
                  {item.birth.birthLatitude && item.birth.birthLongitude ? (
                    <span className="mt-1 block text-xs text-[var(--app-copy-soft)]">위도 {item.birth.birthLatitude} · 경도 {item.birth.birthLongitude}</span>
                  ) : null}
                </td>
                <td className="whitespace-nowrap px-4 py-4 align-top">
                  <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul', hour12: false }).slice(0, 16)}</time>
                </td>
                <td className="px-4 py-4 align-top">
                  <Link href={`/admin/external-report/history/${item.id}`} prefetch={false}
                    className="inline-block whitespace-nowrap rounded-md border border-[var(--app-line)] px-3 py-2 text-xs font-bold"
                    aria-label={`${item.subjectName} ${item.reportNo} PDF 재다운로드`}>
                    PDF 재다운로드
                  </Link>
                </td>
              </tr>
            ))}
            {history.items.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-[var(--app-copy-soft)]">
                {history.page === 1 ? '아직 저장된 PDF 생성 기록이 없습니다. 새 PDF를 생성하면 여기에 표시됩니다.' : '이 페이지에 생성 기록이 없습니다.'}
              </td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <nav aria-label="PDF 생성 기록 페이지" className="flex items-center gap-4 text-sm">
        {history.page > 1 ? <Link href={`/admin/external-report/history?page=${history.page - 1}`} className="underline underline-offset-4">이전</Link> : null}
        <span aria-current="page">{history.page}페이지</span>
        {history.hasMore ? <Link href={`/admin/external-report/history?page=${history.page + 1}`} className="underline underline-offset-4">다음</Link> : null}
      </nav>
    </AdminPage>
  );
}
