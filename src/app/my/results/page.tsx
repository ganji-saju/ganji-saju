import Link from 'next/link';
import { redirect } from 'next/navigation';
import SavedReadingsList from '@/components/my/saved-readings-list';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { getAccountDashboardData } from '@/lib/account';

const RESULTS_PAGE_SIZE = 30;

interface MyResultsPageProps {
  searchParams?: Promise<{
    page?: string;
  }>;
}

function parsePageNumber(value: string | undefined) {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function buildResultsPageHref(page: number) {
  return page <= 1 ? '/my/results' : `/my/results?page=${page}`;
}

export default async function MyResultsPage({ searchParams }: MyResultsPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const currentPage = parsePageNumber(params?.page);
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

  return (
    <div className="gangi-vault-page space-y-5">
      <GangiPageHeader title="보관함" />

      <nav className="gangi-vault-filter" aria-label="보관함 필터">
        <span data-active="true">전체</span>
        <span>무료</span>
        <span>결제 풀이</span>
      </nav>

      <SavedReadingsList
        readings={dashboard.recentReadings}
        purchasedResults={dashboard.purchasedResults}
        totalCount={dashboard.readingCount}
        visibleStartIndex={firstVisibleIndex || 1}
      />

      {totalPages > 1 ? (
        <div className="flex flex-wrap justify-center gap-2 px-4 pb-6">
          {hasPreviousPage ? (
            <Link href={buildResultsPageHref(currentPage - 1)} className="gangi-secondary-button">
              이전
            </Link>
          ) : null}
          {hasNextPage ? (
            <Link href={buildResultsPageHref(currentPage + 1)} className="gangi-secondary-button">
              다음
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
