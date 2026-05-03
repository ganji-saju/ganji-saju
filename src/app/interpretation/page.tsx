import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ActionCluster } from '@/components/layout/action-cluster';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { SupportRail } from '@/components/layout/support-rail';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell, PageHero } from '@/shared/layout/app-shell';
import {
  INTERPRETATION_ENTRY_GUIDE,
  REPORT_SAMPLE_HREF,
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
          description="개념 설명은 이용 안내로 분리하고, 이 화면에서는 사주·궁합·타로처럼 실제로 열어볼 입구만 먼저 보여드립니다."
        />

        <section className="grid gap-6 lg:grid-cols-[1.04fr_0.96fr]">
          <SectionSurface surface="lunar" size="lg">
            <div className="app-starfield" />
            <SectionHeader
              eyebrow="빠른 시작"
              title="가장 많이 찾는 세 가지 길"
              titleClassName="text-3xl text-[var(--app-gold-text)]"
              description="처음이라면 아래 셋 중 하나만 고르셔도 충분합니다. 더 자세한 도움말은 안내 페이지에서 따로 보실 수 있습니다."
              actions={
                <ActionCluster>
                  <Link href="/saju/new" className="moon-cta-primary">
                    내 깊은 사주풀이 만들기
                  </Link>
                  <Link
                    href="/guide"
                    className="moon-action-secondary"
                  >
                    이용 안내 보기
                  </Link>
                </ActionCluster>
              }
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

          <SupportRail
            surface="panel"
            eyebrow="처음이라면"
            title="설명보다 먼저 결과를 보셔도 됩니다"
            description="사주 풀이는 전체 개념을 다 외워야 읽을 수 있는 서비스가 아닙니다. 먼저 결과를 보고, 이해가 필요한 기준만 나중에 펼쳐보면 됩니다."
          >
            <ActionCluster className="mt-5">
              <Link
                href={REPORT_SAMPLE_HREF}
                className="moon-action-secondary"
              >
                샘플 리포트
              </Link>
              <Link
                href="/guide"
                className="inline-flex items-center gap-2 px-1 py-2 text-sm text-[var(--app-gold-text)] underline underline-offset-4 hover:text-[var(--app-ivory)]"
              >
                도움말 보기
              </Link>
            </ActionCluster>
          </SupportRail>
        </section>

        <SectionSurface surface="panel">
          <SectionHeader
            eyebrow="해석 입구"
            title="필요한 서비스만 골라서 열어보세요"
            titleClassName="text-3xl"
            description="각 카드는 실제 결과 화면으로 이어지는 입구입니다. 긴 설명은 줄이고, 선택과 이동을 먼저 놓았습니다."
          />

          <ProductGrid columns={3} className="mt-6">
            {WISDOM_CARDS.map((card) => {
              const tone = toneClasses(card.tone);

              return (
                <FeatureCard
                  key={card.slug}
                  surface="soft"
                  eyebrow={<span className={`font-hanja tracking-[0.22em] ${tone.text}`}>{card.hanja}</span>}
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

        <section className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
          <SectionSurface surface="panel">
            <SectionHeader
              eyebrow="시작 추천"
              title="막막할 때는 이 셋 중 하나만 고르세요"
              titleClassName="text-3xl"
              description="긴 설명 대신, 가장 자주 쓰는 시작점만 남겼습니다."
            />

            <div className="mt-6 grid gap-4">
              {INTERPRETATION_ENTRY_GUIDE.map((item) => (
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
            </div>
          </SectionSurface>

          <SectionSurface surface="lunar">
            <div className="app-starfield" />
            <SectionHeader
              eyebrow="개념과 기준"
              title="도움말은 별도 안내에서 확인하세요"
              titleClassName="text-3xl text-[var(--app-gold-text)]"
              description="서비스 화면을 길게 만들던 개념 설명, 계산 기준, 판단 흐름은 안내 페이지에 모았습니다."
            />

            <ActionCluster className="mt-6">
              <Link href="/guide" className="moon-cta-primary">
                이용 안내 보기
              </Link>
              <Link
                href="/method"
                className="moon-action-secondary"
              >
                계산 기준 보기
              </Link>
            </ActionCluster>
          </SectionSurface>
        </section>
      </AppPage>
    </AppShell>
  );
}
