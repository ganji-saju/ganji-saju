import Link from 'next/link';
import type { Metadata } from 'next';
import SiteHeader from '@/features/shared-navigation/site-header';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DREAM_ENTRIES } from '@/lib/free-content-pages';
import { AppPage, AppShell, PageHero } from '@/shared/layout/app-shell';

export const metadata: Metadata = {
  title: '꿈해몽',
  description: '자주 찾는 꿈해몽 키워드를 짧고 선명하게 정리한 무료 페이지입니다.',
  alternates: {
    canonical: '/dream-interpretation',
  },
};

export default function DreamInterpretationPage() {
  return (
    <AppShell header={<SiteHeader />} className="pb-24 md:pb-12">
      <AppPage className="space-y-6">
        <PageHero
          badges={[
            <Badge
              key="dream"
              className="border-[var(--app-pink-line)] bg-[var(--app-pink-soft)] text-[var(--app-pink-strong)]"
            >
              꿈해몽
            </Badge>,
            <Badge
              key="free"
              className="border-[var(--app-line)] bg-white text-[var(--app-copy-muted)]"
            >
              무료 풀이
            </Badge>,
          ]}
          title="마음에 남은 꿈을 짧게 풀어보세요"
          description="꿈은 정답보다 지금 마음의 결을 비추는 장면에 가깝습니다. 자주 떠오르는 상징을 쉽고 짧게 정리했습니다."
        />

        <ProductGrid columns={2}>
          {DREAM_ENTRIES.map((item) => (
            <Link
              key={item.slug}
              href={`/dream-interpretation/${item.slug}`}
              className="group"
            >
              <FeatureCard
                surface="soft"
                className="h-full transition group-hover:-translate-y-0.5 group-hover:border-[var(--app-pink-line)] group-hover:shadow-[0_18px_36px_rgba(216,27,114,0.12)]"
                eyebrow="무료 꿈해몽"
                title={item.title}
                description={item.summary}
                footer={<div className="text-sm font-semibold text-[var(--app-pink-strong)]">꿈 풀이 보기</div>}
              />
            </Link>
          ))}
        </ProductGrid>

        <SectionSurface size="lg">
          <SectionHeader
            eyebrow="다음으로 보기"
            title="감정 흐름을 더 보고 싶다면"
            description={
              <>
            꿈해몽은 상징을 가볍게 헤아리는 첫 걸음입니다. 더 개인화된 질문이나 지금 흐름이 궁금하시다면 오늘의 타로나 사주 리포트로 이어보시면 좋습니다.
              </>
            }
          />
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/tarot/daily">
              <Button className="px-6">
                오늘의 타로 보기
              </Button>
            </Link>
            <Link href="/saju/new">
              <Button variant="outline">
                사주 입력하기
              </Button>
            </Link>
          </div>
        </SectionSurface>
      </AppPage>
    </AppShell>
  );
}
