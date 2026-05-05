import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Lock } from 'lucide-react';
import { COMPATIBILITY_RELATIONSHIPS } from '@/content/moonlight';
import { ActionCluster } from '@/components/layout/action-cluster';
import { BulletList } from '@/components/layout/bullet-list';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { SupportRail } from '@/components/layout/support-rail';
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
    badgeCls: 'border-[var(--app-coral)]/25 bg-[var(--app-coral)]/10 text-[var(--app-coral)]',
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
    badgeCls: 'border-[var(--app-sky)]/25 bg-[var(--app-sky)]/10 text-[var(--app-sky)]',
  },
  partner: {
    type: 'partner',
    icon: '✦',
    badge: '동업·파트너',
    badgeCls: 'border-[var(--app-gold)]/25 bg-[var(--app-gold)]/10 text-[var(--app-gold-text)]',
  },
};

const COMPATIBILITY_GUIDE = [
  '두 사람의 결이 어디에서 닮고 어디에서 어긋나는지 구조로 정리합니다.',
  '갈등이 반복되는 이유와 가까워지는 방식의 차이를 생활 언어로 설명합니다.',
  '관계의 현재 분위기뿐 아니라, 올해 대화 타이밍과 리듬까지 함께 살펴봅니다.',
] as const;

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
          description="궁합은 한 사람의 운세를 더하는 기능보다, 두 사람의 결이 어디에서 맞고 어긋나는지 보는 입구에 가깝습니다. 관계를 고른 뒤 질문의 결을 좁혀가시면 됩니다."
        />

        <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <SectionSurface surface="panel">
            <SectionHeader
              eyebrow="관계 선택"
              title="질문이 분명할수록 궁합 풀이도 더 선명해집니다"
              titleClassName="text-3xl"
              description="연인·배우자, 부모·자녀, 형제·친구, 동업·파트너처럼 관계의 결을 고르면, 같은 궁합이라도 어디에 초점을 둘지가 훨씬 또렷해집니다."
              descriptionClassName="text-[var(--app-copy)]"
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
                    description={`${item.title} 기준으로 질문을 좁혀 입력 화면에서 관계의 흐름을 바로 시작하실 수 있습니다.`}
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

          <SupportRail
            surface="muted"
            eyebrow="궁합 풀이에서 함께 보는 것"
            title="궁합은 감정만이 아니라 구조와 타이밍을 함께 읽습니다"
            description="관계가 잘 맞는지 여부만 단정하기보다, 어디에서 힘이 맞고 어디에서 속도가 어긋나는지 층을 나눠 설명하는 방식에 더 가깝습니다."
          >
            <BulletList items={COMPATIBILITY_GUIDE} />

            <ActionCluster className="mt-5">
              <Link
                href="/membership"
                className="moon-action-primary"
              >
                프리미엄 기준 보기
              </Link>
              <Link
                href="/sample-report"
                className="moon-action-muted"
              >
                샘플 리포트 보기
              </Link>
            </ActionCluster>
          </SupportRail>
        </section>

        <SectionSurface surface="lunar">
          <div className="app-starfield" />
          <SectionHeader
            eyebrow="프리미엄 전용"
            title="두 사람의 결이 어디서 닮고 어디서 어긋나는지, 풀이 형태로 정리합니다"
            titleClassName="text-3xl text-[var(--app-gold-text)]"
            description="처음이시라면 관계를 고르고 입력 화면까지 먼저 천천히 둘러보실 수 있습니다. 프리미엄 궁합 해석은 갈등이 반복되는 이유, 가까워지는 방식, 올해 대화 타이밍까지 조금 더 길고 차분한 결과물로 이어집니다."
            descriptionClassName="text-[var(--app-copy)]"
            actions={
              <ActionCluster>
                <Link
                  href="/membership"
                  className="moon-action-primary"
                >
                  <Lock className="h-3.5 w-3.5" /> 멤버십으로 열기
                </Link>
                <Link
                  href="/compatibility/input?relationship=lover"
                  className="moon-action-muted"
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
