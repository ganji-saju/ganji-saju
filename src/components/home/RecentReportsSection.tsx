import Link from 'next/link';
import { ArrowRight, Archive, LockKeyhole } from 'lucide-react';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { buttonVariants } from '@/components/ui/button';
import { HOME_SECTION_COPY } from '@/config/home/homeCopy';
import { HOME_ROUTES } from '@/config/home/homeNavigation';
import { HomeSection } from './HomeSection';
import type { RecentReportSummary } from './home.types';

type RecentReportsSectionProps = {
  isAuthenticated?: boolean;
  reports?: readonly RecentReportSummary[];
  loginHref?: string;
  archiveHref?: string;
  className?: string;
};

export function RecentReportsSection({
  isAuthenticated = false,
  reports = [],
  loginHref = '/login?next=/my',
  archiveHref = HOME_ROUTES.archive,
  className,
}: RecentReportsSectionProps) {
  const hasReports = isAuthenticated && reports.length > 0;

  return (
    <HomeSection
      id="home-recent-reports"
      tone="muted"
      eyebrow={HOME_SECTION_COPY.archive.eyebrow}
      title={HOME_SECTION_COPY.archive.title}
      description={HOME_SECTION_COPY.archive.description}
      className={className}
      actions={
        <Link
          href={isAuthenticated ? archiveHref : loginHref}
          data-analytics-event="home_archive_clicked"
          data-analytics-section="recent-reports"
          data-analytics-service-id={isAuthenticated ? 'archive' : 'login'}
          data-analytics-target={isAuthenticated ? 'archive' : 'login'}
          className={buttonVariants({ variant: 'secondary', size: 'lg', className: 'min-h-12 w-full sm:w-auto' })}
        >
          {isAuthenticated ? HOME_SECTION_COPY.archive.ctaLabel : '로그인하고 보관함 보기'}
          <ArrowRight data-icon="inline-end" className="h-4 w-4" />
        </Link>
      }
    >
      {hasReports ? (
        <ProductGrid columns={3}>
          {reports.slice(0, 3).map((report) => (
            <FeatureCard
              key={report.id}
              surface="soft"
              className="flex h-full min-h-[12rem] flex-col justify-between"
              icon={
                <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-[var(--app-pink-strong)] ring-1 ring-[var(--app-pink-line)]">
                  <Archive className="h-5 w-5" />
                </span>
              }
              badge={report.badge ? <span className="text-xs font-bold text-[var(--app-copy-muted)]">{report.badge}</span> : null}
              title={report.title}
              description={report.description}
              footer={
                <div className="grid gap-3">
                  {report.createdAtLabel ? (
                    <p className="text-xs font-bold text-[var(--app-copy-muted)]">{report.createdAtLabel}</p>
                  ) : null}
                  <Link
                    href={report.href}
                    data-analytics-event="home_archive_clicked"
                    data-analytics-section="recent-reports"
                    data-analytics-service-id="saved-report"
                    data-analytics-target="saved-report"
                    className={buttonVariants({ variant: 'outline', size: 'lg', className: 'min-h-12 w-full' })}
                  >
                    다시 보기
                    <ArrowRight data-icon="inline-end" className="h-4 w-4" />
                  </Link>
                </div>
              }
            />
          ))}
        </ProductGrid>
      ) : (
        <FeatureCard
          surface="soft"
          icon={
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-[var(--app-pink-strong)] ring-1 ring-[var(--app-pink-line)]">
              <LockKeyhole className="h-5 w-5" />
            </span>
          }
          title={isAuthenticated ? '아직 저장된 리포트가 없습니다.' : '로그인하면 이전 풀이를 이어볼 수 있어요.'}
          description={
            isAuthenticated
              ? '성향사주, 성향궁합, 오늘운세를 본 뒤 저장된 결과가 이곳에서 이어집니다.'
              : '보관함은 로그인 후 사용할 수 있습니다. 홈에서는 개인정보를 노출하지 않고 안내만 보여줍니다.'
          }
          footer={
            <Link
              href={isAuthenticated ? HOME_ROUTES.sajuPersonality : loginHref}
              data-analytics-event="home_archive_clicked"
              data-analytics-section="recent-reports"
              data-analytics-service-id={isAuthenticated ? 'first-report' : 'login'}
              data-analytics-target={isAuthenticated ? 'first-report' : 'login'}
              className={buttonVariants({ size: 'lg', className: 'min-h-12 w-full sm:w-auto' })}
            >
              {isAuthenticated ? '첫 리포트 만들기' : '로그인하기'}
              <ArrowRight data-icon="inline-end" className="h-4 w-4" />
            </Link>
          }
        />
      )}
    </HomeSection>
  );
}
