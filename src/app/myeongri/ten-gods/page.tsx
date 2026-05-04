import Link from 'next/link';
import type { Metadata } from 'next';
import { ActionCluster } from '@/components/layout/action-cluster';
import { BulletList } from '@/components/layout/bullet-list';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { SupportRail } from '@/components/layout/support-rail';
import { Badge } from '@/components/ui/badge';
import { TEN_GODS_GUIDE } from '@/content/moonlight';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell, PageHero } from '@/shared/layout/app-shell';

export const metadata: Metadata = {
  title: '십신',
  description: '십신으로 열 가지 관계와 역할 패턴을 읽는 달빛인생의 명리 탐구 화면입니다.',
  alternates: {
    canonical: '/myeongri/ten-gods',
  },
};

const TEN_GOD_RULES = [
  '십신은 좋고 나쁨을 바로 가르는 카드가 아니라, 사람과 역할이 반복되는 방식을 읽는 언어입니다.',
  '돈, 책임, 인정, 사람 사이 거리처럼 일상에서 자주 부딪히는 주제를 쉽게 나누어 봅니다.',
  '십신 하나만 외우기보다, 내 현재 고민과 연결해서 볼 때 실제 삶의 장면과 더 잘 맞물립니다.',
] as const;

export default function TenGodsPage() {
  return (
    <AppShell header={<SiteHeader />} className="pb-24 md:pb-12">
      <AppPage className="space-y-6">
        <PageHero
          badges={[
            <Badge
              key="ten-gods"
              className="border-[var(--app-gold)]/25 bg-[var(--app-gold)]/10 text-[var(--app-gold-soft)]"
            >
              명리 탐구
            </Badge>,
            <Badge
              key="hanja"
              className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]"
            >
              十神 · 열 가지 관계 패턴
            </Badge>,
          ]}
          title="십신은 사람과 역할이 왜 비슷하게 반복되는지 보는 힌트입니다"
          description="배우자, 동료, 돈, 인정, 책임처럼 삶에서 자주 부딪히는 장면을 십신으로 읽으면, 왜 같은 고민이 반복되는지가 더 또렷해집니다."
        />

        <section className="grid gap-6 lg:grid-cols-[1.04fr_0.96fr]">
          <SectionSurface surface="lunar" size="lg">
            <div className="app-starfield" />
            <SectionHeader
              eyebrow="십신으로 보는 반복 패턴"
              title="좋고 나쁨보다, 어떤 관계와 역할이 반복되는지를 먼저 봅니다"
              titleClassName="text-3xl text-[var(--app-gold-text)]"
              description="십신은 한 장짜리 성격 해석이 아니라, 돈과 자리, 사람과 책임이 내 삶에 들어오는 방식을 읽는 언어입니다. 달빛인생에서는 겁을 주는 말보다 실제로 반복되는 장면을 설명하는 데 가깝게 씁니다."
              descriptionClassName="max-w-3xl text-[var(--app-copy)]"
            />

            <ProductGrid columns={3} className="mt-6">
              {TEN_GODS_GUIDE.map((item) => (
                <article
                  key={item.hanja}
                  className="rounded-[22px] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-5 py-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="app-caption text-[var(--app-gold-soft)]">{item.hanja}</div>
                      <div className="mt-2 text-xl font-semibold text-[var(--app-ivory)]">{item.name}</div>
                    </div>
                    <Badge className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-soft)]">
                      {item.meaning}
                    </Badge>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-[var(--app-gold-text)]">“{item.seniorCopy}”</p>
                  <p className="mt-4 text-sm leading-7 text-[var(--app-copy-muted)]">
                    {item.meaning.replaceAll(' · ', ', ')} 같은 주제가 삶에서 유난히 자주 부각될 때 이 십신을 함께 살펴봅니다.
                  </p>
                </article>
              ))}
            </ProductGrid>
          </SectionSurface>

          <SupportRail
            surface="panel"
            eyebrow="함께 보면 좋은 힌트"
            title="십신은 단독 지식보다 내 사주 위에 올려놓았을 때 더 선명합니다"
            description="내 기질과 다섯 기운의 균형과 함께 읽을 때 지금 가장 도드라지는 관계 패턴을 더 쉽게 볼 수 있습니다."
          >
            <BulletList items={TEN_GOD_RULES} />

            <SectionHeader
              className="mt-6"
              eyebrow="바로 이어보기"
              title="개념을 읽었다면, 내 사주 결과로 바로 넘어가 보세요"
              titleClassName="text-xl"
              description="십신은 실제 내 사주 위에서 확인할 때 훨씬 빠르게 체감됩니다."
              descriptionClassName="text-[var(--app-copy)]"
              actions={
                <ActionCluster>
                  <Link
                    href="/saju/new"
                    className="moon-action-primary"
                  >
                    내 사주 시작하기
                  </Link>
                  <Link
                    href="/interpretation"
                    className="moon-action-muted"
                  >
                    다른 해석 보기
                  </Link>
                </ActionCluster>
              }
            />
          </SupportRail>
        </section>
      </AppPage>
    </AppShell>
  );
}
