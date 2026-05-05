import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { ActionCluster } from '@/components/layout/action-cluster';
import SavedReadingsList from '@/components/my/saved-readings-list';
import { FeatureCard } from '@/components/layout/feature-card';
import { GangiIntro } from '@/components/gangi/gangi-ui';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { SupportRail } from '@/components/layout/support-rail';
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
  const lastVisibleIndex = readingOffset + dashboard.recentReadings.length;
  const rangeLabel =
    dashboard.readingCount === 0 ? '보관된 결과 없음' : `${firstVisibleIndex}~${lastVisibleIndex}번째`;
  const hasPreviousPage = currentPage > 1;
  const hasNextPage = currentPage < totalPages;

  return (
    <div className="space-y-6">
      <GangiIntro
        eyebrow="보관함"
        title={
          <>
            저장한 풀이를
            <br />
            다시 열어보세요
          </>
        }
        description="한 번 만든 사주, 타로, 궁합 결과를 이곳에서 다시 볼 수 있습니다. 삭제하면 목록과 개수가 바로 갱신됩니다."
      />

      <section className="grid gap-6 lg:grid-cols-[1.04fr_0.96fr]">
        <SectionSurface surface="panel" size="lg">
          <SectionHeader
            eyebrow="저장된 결과"
            title="다시 보고 싶은 풀이만 모았습니다"
            titleClassName="text-3xl"
            description={`전체 ${dashboard.readingCount}개 결과를 보관 중입니다. 다시 열거나 필요 없는 결과를 정리할 수 있습니다.`}
            descriptionClassName="max-w-3xl text-[var(--app-copy)]"
            actions={
              <ActionCluster>
                <Badge className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]">
                  {dashboard.readingCount === 0 ? '보관함 비어 있음' : `${rangeLabel} 표시 중`}
                </Badge>
                {totalPages > 1 ? (
                  <Badge className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]">
                    {currentPage} / {totalPages} 페이지
                  </Badge>
                ) : null}
              </ActionCluster>
            }
          />
          <div className="mt-6">
            <SavedReadingsList
              readings={dashboard.recentReadings}
              totalCount={dashboard.readingCount}
              visibleStartIndex={firstVisibleIndex || 1}
            />
          </div>
          {totalPages > 1 ? (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--app-line)] pt-5">
              <p className="text-sm text-[var(--app-copy-muted)]">
                오래된 결과까지 다시 볼 수 있도록 30개씩 나눠 보여드립니다.
              </p>
              <div className="flex flex-wrap gap-2">
                {hasPreviousPage ? (
                  <Link
                    href={buildResultsPageHref(currentPage - 1)}
                    className="gangi-secondary-button moon-action-compact"
                  >
                    이전 30개
                  </Link>
                ) : null}
                {hasNextPage ? (
                  <Link
                    href={buildResultsPageHref(currentPage + 1)}
                    className="gangi-secondary-button moon-action-compact"
                  >
                    다음 30개
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </SectionSurface>

        <SupportRail
          surface="panel"
          eyebrow="보관함 기준"
          title="다시 여는 흐름도 처음과 같은 문법으로 정리합니다"
          description="보관함은 새 결과를 만드는 흐름과 분리되지 않고, 이미 만든 결과를 다시 열고 질문을 바꾸어 비교하는 흐름으로 이어집니다."
        >
          <FeatureCard
            surface="soft"
            eyebrow="다시 보기"
            description="이미 만든 결과는 보관함에서 다시 열 수 있고, 한 번 해금한 상세 항목은 같은 항목으로 중복 차감되지 않도록 처리합니다."
          />
          <FeatureCard
            className="mt-4"
            surface="soft"
            eyebrow="정리하기"
            description="더 이상 필요 없는 결과는 보관함에서 직접 삭제할 수 있어, 개인 공간이 불필요하게 무거워지지 않도록 관리합니다."
          />
        </SupportRail>
      </section>
    </div>
  );
}
