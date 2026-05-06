import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell, PageHero } from '@/shared/layout/app-shell';
import {
  WISDOM_CARDS,
  toneClasses,
} from '@/content/moonlight';

export const metadata: Metadata = {
  title: '해석',
  description: '사주, 명리, 타로, 궁합, 별자리, 띠운세 중 지금의 질문에 맞는 해석 입구를 고르실 수 있습니다.',
  alternates: { canonical: '/interpretation' },
};

const QUICK_GUIDE = [
  {
    title: '오래 볼 풀이가 필요할 때',
    body: '사주와 명리에서 나의 바탕, 오행, 대운, 올해 흐름을 먼저 확인합니다.',
    href: '/saju/new',
    cta: '사주 시작',
  },
  {
    title: '상대와의 관계가 궁금할 때',
    body: '내 정보와 상대 정보를 넣고 관계의 결, 갈등 지점, 보완점을 봅니다.',
    href: '/compatibility/input',
    cta: '궁합 보기',
  },
  {
    title: '오늘 마음을 가볍게 보고 싶을 때',
    body: '타로, 별자리, 띠운세처럼 부담 없는 입구에서 하루 흐름을 살핍니다.',
    href: '/tarot/daily',
    cta: '가볍게 열기',
  },
] as const;

export default function InterpretationPage() {
  return (
    <AppShell header={<SiteHeader />} className="pb-24 md:pb-0">
      <AppPage className="space-y-6">
        <PageHero
          badges={[
            <Badge
              key="hub"
              className="border-[var(--app-gold)]/24 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]"
            >
              해석 허브
            </Badge>,
            <Badge
              key="guide"
              className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]"
            >
              바로 선택
            </Badge>,
          ]}
          title="지금 궁금한 해석을 바로 고르세요"
          description="사주·궁합·타로 중 지금 필요한 풀이로 바로 이동합니다."
        />

        <SectionSurface surface="panel" size="lg">
            <SectionHeader
              eyebrow="빠른 시작"
              title="가장 많이 찾는 세 가지 길"
              titleClassName="text-3xl text-[var(--app-gold-text)]"
            />

            <ProductGrid columns={3} className="mt-6">
              {QUICK_GUIDE.map((item) => (
                <FeatureCard
                  key={item.title}
                  surface="soft"
                  title={item.title}
                  titleClassName="text-2xl"
                  description={item.body}
                  footer={
                    <Link
                      href={item.href}
                      className="inline-flex items-center gap-2 text-sm text-[var(--app-gold-text)] underline underline-offset-4 hover:text-[var(--app-ivory)]"
                    >
                      {item.cta}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  }
                />
              ))}
            </ProductGrid>
        </SectionSurface>

        <SectionSurface surface="panel">
          <SectionHeader
            eyebrow="해석 입구"
            title="필요한 서비스만 골라서 열어보세요"
            titleClassName="text-3xl"
          />

          <ProductGrid columns={3} className="mt-6">
            {WISDOM_CARDS.map((card) => {
              const tone = toneClasses(card.tone);

              return (
                <FeatureCard
                  key={card.slug}
                  surface="soft"
                  eyebrow={<span className={` tracking-[0.22em] ${tone.text}`}>{card.hanja}</span>}
                  title={card.title}
                  titleClassName={`text-2xl ${tone.text}`}
                  description={card.hook}
                  footer={
                    <Link
                      href={card.href}
                      className={`inline-flex items-center gap-2 text-sm underline underline-offset-4 hover:text-[var(--app-ivory)] ${tone.text}`}
                    >
                      바로 열기
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  }
                />
              );
            })}
          </ProductGrid>
        </SectionSurface>
      </AppPage>
    </AppShell>
  );
}
