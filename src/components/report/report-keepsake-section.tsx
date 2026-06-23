import Link from 'next/link';
import { Archive, FileText, MessageCircleMore, RefreshCw } from 'lucide-react';
import { TrackedButton } from '@/components/common/tracked-button';
import { TrackedLink } from '@/components/common/tracked-link';
import { ActionCluster } from '@/components/layout/action-cluster';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import type { MoonlightAnalyticsEvent } from '@/lib/analytics-events';
import { cn } from '@/lib/utils';

type ReportKeepsakeAction = {
  label: string;
  href?: string;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'muted';
  eventName?: MoonlightAnalyticsEvent;
  eventParams?: Record<string, unknown>;
};

type ReportKeepsakeSectionProps = {
  className?: string;
  title?: string;
  description?: string;
  pdfHref?: string | null;
  resultsHref?: string;
  dialogueHref?: string;
  updatesHref?: string;
  actions?: ReportKeepsakeAction[];
};

const DEFAULT_TITLE = '한 번 보고 사라지지 않도록 보관합니다';
const DEFAULT_DESCRIPTION =
  '내 사주의 핵심, 올해 흐름, 중요한 선택 힌트는 시간이 지나도 다시 확인할 수 있어야 합니다. 간지사주 리포트는 PDF와 MY 보관함, 대화 상담으로 이어집니다.';

function actionClassName(variant: ReportKeepsakeAction['variant']) {
  switch (variant) {
    case 'primary':
      return 'gangi-primary-button';
    case 'secondary':
      return 'gangi-secondary-button';
    default:
      return 'gangi-secondary-button';
  }
}

export function ReportKeepsakeSection({
  className,
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  pdfHref = null,
  resultsHref = '/my/results',
  dialogueHref = '/dialogue',
  updatesHref = '/saju/new?product=yearly-2026',
  actions,
}: ReportKeepsakeSectionProps) {
  const items = [
    {
      title: 'PDF 다운로드',
      body: '표지, 요약, 본문을 한 편의 리포트로 정리합니다.',
      href: pdfHref,
      ctaLabel: pdfHref ? 'PDF 열기' : '출시 예정',
      icon: FileText,
      statusTone: pdfHref
        ? 'border-[var(--app-gold)]/28 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]'
        : 'border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-soft)]',
    },
    {
      title: 'MY 보관함',
      body: '다시 읽고 싶은 해석을 저장하고, 가족·궁합 리포트와 이어볼 수 있습니다.',
      href: resultsHref,
      ctaLabel: '보관함 보기',
      icon: Archive,
      statusTone: 'border-[var(--app-gold)]/28 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]',
    },
    {
      title: '대화 연결',
      body: '이미 본 풀이를 바탕으로 간지사주에게 이어서 질문할 수 있습니다.',
      href: dialogueHref,
      ctaLabel: '대화 이어보기',
      icon: MessageCircleMore,
      statusTone: 'border-[var(--app-gold)]/28 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]',
    },
    {
      title: '업데이트',
      body: '연간·월간 흐름은 같은 사주 정보 위에서 다시 정리됩니다.',
      href: updatesHref,
      ctaLabel: '흐름 다시 보기',
      icon: RefreshCw,
      statusTone: 'border-[var(--app-gold)]/28 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]',
    },
  ] as const;

  return (
    <SectionSurface surface="panel" className={className}>
      <SectionHeader
        eyebrow="리포트 소장 가치"
        title={title}
        description={description}
        titleClassName="text-3xl"
        descriptionClassName="text-[var(--app-copy)]"
      />

      <ProductGrid columns={4} className="mt-6">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <FeatureCard
              key={item.title}
              surface="soft"
              icon={
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--app-gold)]/20 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]">
                  <Icon className="h-4 w-4" />
                </div>
              }
              badge={
                <span className={cn('rounded-full border px-2.5 py-1 text-[12.6px]', item.statusTone)}>
                  {item.ctaLabel}
                </span>
              }
              title={item.title}
              titleClassName="text-xl"
              description={item.body}
              footer={
                item.href ? (
                  <Link
                    href={item.href}
                    className="text-sm text-[var(--app-gold-text)] underline underline-offset-4 hover:text-[var(--app-ivory)]"
                  >
                    {item.ctaLabel}
                  </Link>
                ) : (
                  <span className="text-sm text-[var(--app-copy-soft)]">{item.ctaLabel}</span>
                )
              }
            >
            </FeatureCard>
          );
        })}
      </ProductGrid>

      {actions && actions.length > 0 ? (
        <ActionCluster className="mt-6">
          {actions.map((action) => {
            if (action.href && !action.disabled) {
              return action.eventName ? (
                <TrackedLink
                  key={action.label}
                  href={action.href}
                  eventName={action.eventName}
                  eventParams={action.eventParams}
                  className={actionClassName(action.variant)}
                >
                  {action.label}
                </TrackedLink>
              ) : (
                <Link
                  key={action.label}
                  href={action.href}
                  className={actionClassName(action.variant)}
                >
                  {action.label}
                </Link>
              );
            }

            if (action.eventName) {
              return (
                <TrackedButton
                  key={action.label}
                  type="button"
                  eventName={action.eventName}
                  eventParams={action.eventParams}
                  className={cn(actionClassName(action.variant), 'opacity-70')}
                >
                  {action.label}
                </TrackedButton>
              );
            }

            return (
              <button
                key={action.label}
                type="button"
                disabled
                aria-disabled="true"
                className={cn(
                  actionClassName(action.variant),
                  'cursor-not-allowed opacity-70 hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-copy)]'
                )}
              >
                {action.label}
              </button>
            );
          })}
        </ActionCluster>
      ) : null}
    </SectionSurface>
  );
}
