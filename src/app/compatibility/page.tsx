import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Lock } from 'lucide-react';
import { COMPATIBILITY_RELATIONSHIPS } from '@/content/moonlight';
import { ActionCluster } from '@/components/layout/action-cluster';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell, PageHero } from '@/shared/layout/app-shell';

export const metadata: Metadata = {
  title: '궁합',
  description: '연인, 배우자, 부모자녀, 가족과의 궁합을 관계별 질문으로 살펴보는 궁합 페이지입니다.',
  alternates: { canonical: '/compatibility' },
};

const RELATIONSHIP_TONES: Record<string, { type: string; icon: string; badge: string; badgeCls: string }> = {
  lover: {
    type: 'lover',
    icon: '💕',
    badge: '연인·배우자',
    badgeCls: 'border-[var(--app-coral)]/25 bg-[var(--app-coral)]/10 text-[var(--app-coral-text)]',
  },
  family: {
    type: 'family',
    icon: '🌿',
    badge: '부모·자녀',
    badgeCls: 'border-[var(--app-jade)]/25 bg-[var(--app-jade)]/10 text-[var(--app-jade)]',
  },
  friend: {
    type: 'friend',
    icon: '🌊',
    badge: '형제·친구',
    badgeCls: 'border-[var(--app-sky)]/25 bg-[var(--app-sky)]/10 text-[var(--app-sky-text)]',
  },
  partner: {
    type: 'partner',
    icon: '✦',
    badge: '동업·파트너',
    badgeCls: 'border-[var(--app-gold)]/25 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]',
  },
};

export default function CompatibilityPage() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-0">
      <AppPage className="gangi-subpage space-y-6">
        <PageHero
          badges={
            <>
              <span className="rounded-full border border-[var(--app-jade)]/24 bg-[var(--app-jade)]/10 px-3 py-1 text-xs text-[var(--app-jade)]">
                관계 풀이 입구
              </span>
              <span className="rounded-full border border-[var(--app-line)] bg-[var(--app-surface-muted)] px-3 py-1 text-xs text-[var(--app-copy-muted)]">
                질문별 관계 선택
              </span>
            </>
          }
          title="관계 풀이를 보기 전에, 어떤 관계를 풀고 싶은지 고르세요"
          description="연인, 가족, 친구, 동업 중 지금 궁금한 관계를 고르세요."
        />

        <SectionSurface surface="panel">
          <SectionHeader
            eyebrow="새 입력 흐름"
            title="사주와 16유형 성향을 함께 넣는 성향궁합"
            titleClassName="text-3xl"
            description="관계 유형, 두 사람의 생년월일, 성향 선택 또는 간단 체크, 현재 질문까지 한 번에 준비합니다."
            actions={
              <ActionCluster>
                <Link href="/compatibility/personality" className="gangi-primary-button">
                  성향궁합 입력하기
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </ActionCluster>
            }
          />
        </SectionSurface>

        <SectionSurface surface="panel">
            <SectionHeader
              eyebrow="관계 선택"
              title="질문이 분명할수록 궁합 풀이도 더 선명해집니다"
              titleClassName="text-3xl"
            />

            <ProductGrid columns={2} className="mt-6">
              {COMPATIBILITY_RELATIONSHIPS.map((item) => {
                const tone = RELATIONSHIP_TONES[item.slug];
                return (
                  <FeatureCard
                    key={item.slug}
                    surface="soft"
                    badge={
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[10px] tracking-[0.14em] ${tone?.badgeCls ?? 'border-[var(--app-line)] text-[var(--app-copy-muted)]'}`}
                      >
                        {tone?.badge ?? item.title}
                      </span>
                    }
                    icon={
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--app-line)] bg-[var(--app-surface-muted)] text-2xl">
                        {tone?.icon ?? item.icon}
                      </div>
                    }
                    title={item.hook}
                    titleClassName="text-xl"
                    description={item.title}
                    footer={
                      <Link
                        href={`/compatibility/input?relationship=${item.slug}`}
                        className="inline-flex items-center gap-2 text-sm font-medium text-[var(--app-gold-text)] underline underline-offset-4 hover:text-[var(--app-ivory)]"
                      >
                        이 관계로 이어보기
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    }
                  />
                );
              })}
            </ProductGrid>
        </SectionSurface>

        <SectionSurface surface="panel">
          <SectionHeader
            eyebrow="프리미엄 전용"
            title="두 사람의 결이 어디서 닮고 어디서 어긋나는지, 풀이 형태로 정리합니다"
            titleClassName="text-3xl text-[var(--app-gold-text)]"
            actions={
              <ActionCluster>
                <Link
                  href="/membership"
                  className="gangi-primary-button"
                >
                  <Lock className="h-3.5 w-3.5" /> 멤버십으로 열기
                </Link>
                <Link
                  href="/compatibility/input?relationship=lover"
                  className="gangi-secondary-button"
                >
                  입력 흐름 먼저 보기
                </Link>
              </ActionCluster>
            }
          />
        </SectionSurface>
      </AppPage>
    </AppShell>
  );
}
