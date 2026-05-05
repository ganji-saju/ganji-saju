import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionCluster } from '@/components/layout/action-cluster';
import { BulletList } from '@/components/layout/bullet-list';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { SupportRail } from '@/components/layout/support-rail';
import { Badge } from '@/components/ui/badge';
import SiteHeader from '@/features/shared-navigation/site-header';
import { getOptionalSignedInProfile } from '@/lib/profile';
import { buildProfileReadingSlug } from '@/lib/profile-personalization';
import { AppPage, AppShell, PageHero } from '@/shared/layout/app-shell';

export const metadata: Metadata = {
  title: '명리',
  description: '타고난 기질, 다섯 기운, 반복되는 관계 패턴을 쉬운 말로 확인하는 달빛인생 명리 화면입니다.',
  alternates: {
    canonical: '/myeongri',
  },
};

const EXPLORATIONS = [
  {
    title: '타고난 기질',
    body: '내가 어떤 상황에서 편해지고, 어떤 장면에서 예민해지는지 기본 결을 살펴봅니다.',
    hook: '나는 어떤 결의 사람인가',
    href: '/saju/new',
    badge: '日柱',
  },
  {
    title: '다섯 기운의 균형',
    body: '무엇이 넘치고 무엇이 부족한지, 일상에서 어떤 방식으로 힘이 붙거나 빠지는지 살펴봅니다.',
    hook: '내 안의 다섯 기운은 어디서 흔들리는가',
    href: '/saju/new',
    badge: '五行',
  },
  {
    title: '반복되는 관계 패턴',
    body: '돈, 일, 사람, 책임이 내 삶에서 어떤 모습으로 반복되는지 쉽게 풀어봅니다.',
    hook: '왜 늘 비슷한 관계와 역할이 반복되는가',
    href: '/myeongri/ten-gods',
    badge: '十神',
  },
] as const;

const MYEONGRI_RULES = [
  '명리는 무서운 예언보다 반복되는 성향을 설명하는 언어에 가깝습니다.',
  '하나의 단어만 외우기보다, 내 기질과 관계 패턴을 함께 보면 더 쉽게 이해됩니다.',
  '설명만 읽는 것보다 내 실제 사주 결과와 번갈아 보는 편이 훨씬 빠르게 와닿습니다.',
] as const;

export default async function MyeongriPage() {
  const profile = await getOptionalSignedInProfile();
  const readingSlug = buildProfileReadingSlug(profile);

  return (
    <AppShell header={<SiteHeader />} className="pb-24 md:pb-12">
      <AppPage className="space-y-6">
        <PageHero
          badges={[
            <Badge
              key="myeongri"
              className="border-[var(--app-gold)]/25 bg-[var(--app-gold)]/10 text-[var(--app-gold-soft)]"
            >
              명리 쉽게 보기
            </Badge>,
            <Badge
              key="scope"
              className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]"
            >
              일간 · 오행 · 십신
            </Badge>,
          ]}
          title="개념을 외우기보다, 내 삶에서 반복되는 장면을 먼저 봅니다"
          description="명리는 어려운 단어를 배우는 페이지가 아니라, 내가 왜 비슷한 고민을 반복하는지 쉽게 확인하는 도움말입니다."
        />

        <section className="grid gap-6 lg:grid-cols-[1.04fr_0.96fr]">
          <SectionSurface surface="panel" size="lg">
            <div className="app-starfield" />
            <SectionHeader
              eyebrow="내 패턴의 바탕"
              title="반복되는 장면의 이유를 내 사주 위에서 확인합니다"
              titleClassName="text-3xl text-[var(--app-gold-text)]"
              description="타고난 기질은 내 반응의 바탕을, 다섯 기운과 관계 패턴은 자주 반복되는 생활 장면을 보여줍니다. 설명을 외우기보다 내 결과와 바로 이어서 봅니다."
              descriptionClassName="max-w-3xl text-[var(--app-copy)]"
            />

            <ProductGrid columns={3} className="mt-6">
              {EXPLORATIONS.map((item) => (
                <FeatureCard
                  key={item.title}
                  surface="soft"
                  eyebrow={item.badge}
                  title={item.title}
                  description={`${item.hook} · ${item.body}`}
                />
              ))}
            </ProductGrid>
          </SectionSurface>

          <SupportRail
            surface="panel"
            eyebrow="풀이 힌트"
            title="명리는 겁을 주는 말이 아니라 반복되는 이유를 설명하는 언어입니다"
            description="개념을 많이 보여주는 것보다, 내 선택과 생활 조언에 어떻게 이어지는지를 먼저 보이도록 정리했습니다."
          >
            <BulletList items={MYEONGRI_RULES} />

            <FeatureCard
              className="mt-5"
              surface="soft"
              eyebrow="바로 이어보기"
              description={
                readingSlug
                  ? '저장된 사주 결과가 있다면, 개념 설명보다 먼저 내 사주로 바로 확인하는 편이 가장 이해가 빠릅니다.'
                  : '저장된 사주 결과가 없다면, 명리 설명을 읽다가 바로 사주 시작 화면으로 넘어가도 흐름이 끊기지 않게 두었습니다.'
              }
            />
          </SupportRail>
        </section>

        {readingSlug ? (
          <SectionSurface surface="panel" size="lg">
            <SectionHeader
              eyebrow="내 사주로 이어보기"
              title="개념 설명보다, 내 사주 위에서 바로 확인할 수 있습니다"
              titleClassName="text-3xl"
              description="읽다가 궁금해진 개념은 실제 결과 화면으로 넘어가면 훨씬 빠르게 이해됩니다. 내 사주를 보며 기질, 다섯 기운, 관계 패턴을 번갈아 확인해 보세요."
              descriptionClassName="max-w-3xl text-[var(--app-copy)]"
              actions={
                <ActionCluster>
                  <Link
                    href={`/saju/${readingSlug}`}
                    className="gangi-primary-button"
                  >
                    내 통합 결과 보기
                  </Link>
                  <Link
                    href={`/saju/${readingSlug}/elements`}
                    className="gangi-secondary-button"
                  >
                    내 오행 바로 보기
                  </Link>
                </ActionCluster>
              }
            />
          </SectionSurface>
        ) : null}

        <SectionSurface surface="panel" size="lg">
          <SectionHeader
            eyebrow="탐구 주제"
            title="명리 안에서 가장 자주 다시 보게 되는 세 가지"
            titleClassName="text-3xl"
            description="설명을 길게 늘어놓기보다, 실제로 많이 다시 보게 되는 세 갈래만 먼저 정리했습니다."
            descriptionClassName="max-w-3xl text-[var(--app-copy)]"
          />

          <ProductGrid columns={3} className="mt-6">
            {EXPLORATIONS.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="group rounded-[22px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-5 py-5 transition-colors hover:bg-[rgba(255,255,255,0.05)]"
              >
                <div className="app-caption text-[var(--app-gold-soft)]">{item.badge}</div>
                <div className="mt-3 text-xl font-semibold text-[var(--app-ivory)]">{item.title}</div>
                <p className="mt-3 text-sm leading-7 text-[var(--app-copy-muted)]">{item.body}</p>
                <div className="mt-4 text-sm font-medium text-[var(--app-gold-text)] transition-transform group-hover:translate-x-1">
                  {item.hook} →
                </div>
              </Link>
            ))}
          </ProductGrid>
        </SectionSurface>
      </AppPage>
    </AppShell>
  );
}
