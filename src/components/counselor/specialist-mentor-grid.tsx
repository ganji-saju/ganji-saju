import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SPECIALIST_MENTORS } from '@/content/specialist-mentors';

interface SpecialistMentorGridProps {
  title?: string;
  description?: string;
  className?: string;
  showHeader?: boolean;
}

export function SpecialistMentorGrid({
  title,
  description,
  className,
  showHeader = true,
}: SpecialistMentorGridProps) {
  return (
    <div className={className}>
      {showHeader && title ? (
        <SectionHeader
          eyebrow="전문 선생"
          title={title}
          description={description}
          titleClassName="text-2xl"
        />
      ) : null}

      <ProductGrid columns={2} className={showHeader && title ? 'mt-5' : ''}>
        {SPECIALIST_MENTORS.map((mentor) => (
          <FeatureCard
            key={mentor.slug}
            surface="soft"
            eyebrow={
              <span className="font-hanja text-xs tracking-[0.22em] text-[var(--app-gold)]/72">
                {mentor.hanja}
              </span>
            }
            title={mentor.title}
            titleClassName="text-xl"
            description={
              <>
                <div className="text-sm font-medium text-[var(--app-gold-text)]">
                  {mentor.specialty}
                </div>
                <p className="mt-2 text-sm leading-7 text-[var(--app-copy)]">{mentor.description}</p>
              </>
            }
            badge={
              <span className="rounded-full border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-3 py-1 text-[11px] text-[var(--app-copy-muted)]">
                {mentor.statusLabel}
              </span>
            }
            footer={
              <Link
                href={mentor.href}
                className="inline-flex items-center gap-2 text-sm font-medium text-[var(--app-gold-text)] underline underline-offset-4 hover:text-[var(--app-ivory)]"
              >
                {mentor.ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            }
          >
          </FeatureCard>
        ))}
      </ProductGrid>

      <p className="mt-4 text-xs leading-6 text-[var(--app-copy-soft)]">
        대화 persona는 순차적으로 확장할 예정이며, 지금은 각 전문 선생이 먼저 잘 맞는 리포트와
        풀이 흐름으로 안내합니다.
      </p>
    </div>
  );
}
