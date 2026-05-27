// Redesign 2026-05-13 (Claude Design / screens-d.jsx ScreenVaultDetail):
// 보관함 — Hero 요약 + filter chips + 카드 list. 데이터 흐름 무수정.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import SavedReadingsList from '@/components/my/saved-readings-list';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { MyStarSignCard } from '@/components/star-sign/my-star-sign-card';
import { getAccountDashboardData } from '@/lib/account';
import { getOptionalSignedInProfile } from '@/lib/profile';

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
  const [dashboard, profile] = await Promise.all([
    getAccountDashboardData('/my/results', {
      readingLimit: RESULTS_PAGE_SIZE,
      readingOffset,
      transactionLimit: 1,
    }),
    getOptionalSignedInProfile(),
  ]);
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

      {/* §2.5 MY 별자리 카드 (compact) — 프로필 birthMonth/Day 자동 매칭 */}
      <MyStarSignCard profile={profile} variant="compact" />

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

      {/* Phase 7d — 보관함 안내: 환불 정책 / 계정 삭제 / 고객센터 link. */}
      <section
        className="rounded-[14px] border border-[var(--app-line)] bg-white p-4 text-[12.5px] leading-[1.7] text-[var(--app-copy)]"
        aria-label="보관함 안내"
      >
        <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
          보관함 안내
        </div>
        <ul className="mt-2 grid gap-1.5">
          <li>
            <span className="font-extrabold text-[var(--app-ink)]">환불 가능 여부:</span> 결제일·
            상품·열람 여부에 따라 다릅니다. 자세한 원칙은 환불 정책에서 확인해 주세요.
          </li>
          <li>
            <span className="font-extrabold text-[var(--app-ink)]">환불 요청:</span> 고객센터
            문의로 접수합니다. 결제 정보 + 사유를 함께 알려주시면 빠르게 안내드립니다.
          </li>
          <li>
            <span className="font-extrabold text-[var(--app-ink)]">개인정보·계정 삭제:</span>{' '}
            마이페이지 설정에서 계정 탈퇴를 선택하시면 보관된 풀이와 결제 이력도 함께 삭제됩니다.
          </li>
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/refund-policy"
            className="inline-flex h-9 items-center justify-center rounded-full border border-[var(--app-line)] bg-white px-3 text-[12px] font-extrabold text-[var(--app-copy)] hover:bg-[var(--app-pink-soft)]"
          >
            환불 정책 자세히
          </Link>
          <Link
            href="/support/contact"
            className="inline-flex h-9 items-center justify-center rounded-full border border-[var(--app-line)] bg-white px-3 text-[12px] font-extrabold text-[var(--app-copy)] hover:bg-[var(--app-pink-soft)]"
          >
            환불 요청 (고객센터)
          </Link>
          <Link
            href="/my/settings/delete-account"
            className="inline-flex h-9 items-center justify-center rounded-full border border-[var(--app-line)] bg-white px-3 text-[12px] font-extrabold text-[var(--app-copy)] hover:bg-[var(--app-pink-soft)]"
          >
            계정·개인정보 삭제
          </Link>
          <Link
            href="/support/faq"
            className="inline-flex h-9 items-center justify-center rounded-full border border-[var(--app-line)] bg-white px-3 text-[12px] font-extrabold text-[var(--app-copy)] hover:bg-[var(--app-pink-soft)]"
          >
            자주 묻는 질문
          </Link>
        </div>
      </section>
    </div>
  );
}
