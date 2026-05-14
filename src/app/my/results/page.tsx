// Redesign 2026-05-13 (Claude Design / screens-d.jsx ScreenVaultDetail):
// 보관함 — Hero 요약 + filter chips + 카드 list. 데이터 흐름 무수정.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import SavedReadingsList from '@/components/my/saved-readings-list';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { getAccountDashboardData } from '@/lib/account';

const RESULTS_PAGE_SIZE = 30;

interface MyResultsPageProps {
  searchParams?: Promise<{
    page?: string;
    filter?: string;
  }>;
}

const FILTERS: Array<{ key: string; label: string }> = [
  { key: 'all', label: '전체' },
  { key: 'saju', label: '사주' },
  { key: 'today', label: '오늘운세' },
  { key: 'gunghap', label: '궁합' },
  { key: 'tarot', label: '타로' },
];

function parsePageNumber(value: string | undefined) {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function buildResultsPageHref(page: number, filter?: string) {
  const params = new URLSearchParams();
  if (page > 1) params.set('page', String(page));
  if (filter && filter !== 'all') params.set('filter', filter);
  const query = params.toString();
  return query ? `/my/results?${query}` : '/my/results';
}

export default async function MyResultsPage({ searchParams }: MyResultsPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const currentPage = parsePageNumber(params?.page);
  const currentFilter = params?.filter ?? 'all';
  const readingOffset = (currentPage - 1) * RESULTS_PAGE_SIZE;
  const dashboard = await getAccountDashboardData('/my/results', {
    readingLimit: RESULTS_PAGE_SIZE,
    readingOffset,
    transactionLimit: 1,
  });
  const totalPages = Math.max(1, Math.ceil(dashboard.readingCount / RESULTS_PAGE_SIZE));

  if (dashboard.readingCount > 0 && currentPage > totalPages) {
    redirect(buildResultsPageHref(totalPages));
  }

  const firstVisibleIndex = dashboard.readingCount === 0 ? 0 : readingOffset + 1;
  const hasPreviousPage = currentPage > 1;
  const hasNextPage = currentPage < totalPages;
  const total = dashboard.readingCount + dashboard.purchasedResults.length;
  const displayName = dashboard.user.email?.split('@')[0] ?? '회원';

  return (
    <div className="gangi-vault-page space-y-5 px-1">
      <GangiPageHeader title="보관함" />

      {/* §1 Hero — 누적 풀이 개수 */}
      <div>
        <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
          {displayName} · 누적 보관
        </div>
        <h1 className="mt-1.5 text-[24px] font-extrabold leading-snug tracking-tight text-[var(--app-ink)]">
          총 <span className="text-[var(--app-pink-strong)]">{total}개</span>의 풀이
        </h1>
      </div>

      {/* §2 Filter chips */}
      <nav
        className="flex gap-1.5 overflow-x-auto pb-1"
        aria-label="보관함 필터"
      >
        {FILTERS.map((filter) => {
          const active = currentFilter === filter.key;
          return (
            <Link
              key={filter.key}
              href={buildResultsPageHref(1, filter.key)}
              className="shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-bold transition"
              style={
                active
                  ? {
                      background: 'var(--app-pink)',
                      color: '#fff',
                      borderColor: 'transparent',
                    }
                  : {
                      background: '#fff',
                      color: 'var(--app-copy-muted)',
                      borderColor: 'var(--app-line)',
                    }
              }
              data-active={active}
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      <SavedReadingsList
        readings={dashboard.recentReadings}
        purchasedResults={dashboard.purchasedResults}
        totalCount={dashboard.readingCount}
        visibleStartIndex={firstVisibleIndex || 1}
      />

      {totalPages > 1 ? (
        <div className="flex flex-wrap justify-center gap-2 px-2 pb-6">
          {hasPreviousPage ? (
            <Link
              href={buildResultsPageHref(currentPage - 1, currentFilter)}
              className="rounded-full border border-[var(--app-line)] bg-white px-5 py-2 text-[12.5px] font-bold text-[var(--app-copy-muted)]"
            >
              이전
            </Link>
          ) : null}
          {hasNextPage ? (
            <Link
              href={buildResultsPageHref(currentPage + 1, currentFilter)}
              className="rounded-full border border-[var(--app-line)] bg-white px-5 py-2 text-[12.5px] font-bold text-[var(--app-copy-muted)]"
            >
              다음
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
