import { BulletList } from '@/components/layout/bullet-list';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';

type ReportOneMinuteSummaryProps = {
  headline: string;
  keyThemes: string[];
  cautionPatterns: string[];
  favorableChoices: string[];
  isTimeUnknown?: boolean;
};

function SummaryList({
  title,
  items,
  tone = 'default',
}: {
  title: string;
  items: string[];
  tone?: 'default' | 'caution';
}) {
  if (items.length === 0) return null;

  return (
    <FeatureCard
      surface="soft"
      className={
        tone === 'caution'
          ? 'border-[var(--app-coral)]/18 bg-[var(--app-coral)]/7'
          : undefined
      }
      eyebrow={title}
      children={
        <BulletList
          items={items}
          className="text-base text-[var(--app-copy)]"
          markerClassName={tone === 'caution' ? 'text-[var(--app-coral)]' : undefined}
        />
      }
    />
  );
}

export function ReportOneMinuteSummary({
  headline,
  keyThemes,
  cautionPatterns,
  favorableChoices,
  isTimeUnknown = false,
}: ReportOneMinuteSummaryProps) {
  return (
    <SectionSurface surface="panel">
      <SectionHeader
        eyebrow="1분 요약"
        title="먼저, 지금 필요한 답만 짚어드립니다"
        titleClassName="text-4xl"
        description="핵심 한 줄, 조심할 패턴, 오늘 할 행동만 먼저 봅니다."
      />

      <FeatureCard
        className="mt-6 border-[var(--app-gold)]/18 bg-[var(--app-gold)]/8"
        surface="soft"
        eyebrow="지금 핵심 한 줄"
        description={headline}
        descriptionClassName="text-lg leading-8 text-[var(--app-ivory)] sm:text-xl"
      />

      {isTimeUnknown ? (
        <div className="mt-4 rounded-[20px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-4 py-4 text-base leading-7 text-[var(--app-copy)]">
          태어난 시간이 정확하지 않아 시간에 민감한 풀이는 조심해서 읽습니다.
        </div>
      ) : null}

      <ProductGrid columns={3} className="mt-4">
        <SummaryList title="조심할 패턴" items={cautionPatterns} tone="caution" />
        <SummaryList title="오늘 할 행동" items={favorableChoices} />
        <SummaryList title="더 깊게 볼 주제" items={keyThemes} />
      </ProductGrid>
    </SectionSurface>
  );
}
