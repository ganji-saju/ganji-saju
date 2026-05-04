import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SupportRail } from '@/components/layout/support-rail';
import { SwipeSectionDeck, SwipeSectionSlide } from '@/components/layout/swipe-section-deck';
import { Badge } from '@/components/ui/badge';
import FiveElementOrbitChart from '@/components/saju/five-element-orbit-chart';
import SajuScreenNav from '@/features/saju-detail/saju-screen-nav';
import { formatBirthSummary } from '@/features/saju-detail/saju-screen-helpers';
import SiteHeader from '@/features/shared-navigation/site-header';
import { ELEMENT_INFO } from '@/lib/saju/elements';
import { resolveReading } from '@/lib/saju/readings';
import type { Element } from '@/lib/saju/types';
import { AppPage, AppShell, PageHero } from '@/shared/layout/app-shell';

interface Props {
  params: Promise<{ slug: string }>;
}

const ELEMENT_ORDER: Element[] = ['목', '화', '토', '금', '수'];

const ELEMENT_SUPPORT_GUIDE: Record<
  Element,
  {
    label: string;
    support: string;
    habits: string[];
  }
> = {
  목: {
    label: '방향을 키우는 기운',
    support: '막혀 있던 흐름을 다시 자라게 하는 축이 필요합니다.',
    habits: ['아침에 먼저 움직이는 약속 만들기', '할 일을 한 줄로 먼저 적기', '식물이나 나무 결이 있는 공간 가까이 두기'],
  },
  화: {
    label: '표현을 밝히는 기운',
    support: '안에 쌓인 생각을 밖으로 꺼내고 분위기를 데우는 축이 더 필요합니다.',
    habits: ['결정 전 감정을 먼저 한 문장으로 말하기', '몸을 따뜻하게 깨우는 산책 넣기', '붉은 계열 포인트를 작은 소품으로 쓰기'],
  },
  토: {
    label: '중심을 묶는 기운',
    support: '흐름을 한곳에 모으고 안정적으로 붙잡는 축을 보완해주면 좋습니다.',
    habits: ['일주일 루틴을 두세 개만 고정하기', '식사와 수면 시간을 흔들리지 않게 잡기', '책상과 서랍을 짧게라도 자주 정리하기'],
  },
  금: {
    label: '정리와 결론의 기운',
    support: '정리하고 마무리하는 축이 더해질수록 전체 리듬이 또렷해집니다.',
    habits: ['흰색·은색 소품을 가까이 두기', '서쪽 방향에서 잠깐 숨 고르기', '정리와 마감 시간을 하루 안에 따로 빼두기'],
  },
  수: {
    label: '깊이와 유연성의 기운',
    support: '급하게 밀기보다 여지를 남기고 깊게 읽는 축을 채워주면 균형이 좋아집니다.',
    habits: ['하루에 조용한 혼자 시간 확보하기', '물을 자주 마시며 속도를 늦추기', '밤에 생각을 정리할 메모 습관 두기'],
  },
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '기운 균형',
    description: '다섯 기운의 균형을 쉽게 확인하는 화면입니다.',
    robots: { index: false, follow: false },
  };
}

export default async function SajuElementsPage({ params }: Props) {
  const { slug } = await params;
  const reading = await resolveReading(slug);

  if (!reading) notFound();

  const { input, sajuData } = reading;
  const dominant = sajuData.fiveElements.dominant;
  const weakest = sajuData.fiveElements.weakest;
  const supportGuide = ELEMENT_SUPPORT_GUIDE[weakest];

  return (
    <AppShell header={<SiteHeader />}>
      <AppPage className="space-y-6">
        <SajuScreenNav slug={slug} current="elements" />

        <PageHero
          badges={
            <>
              <Badge className="border-[var(--app-gold)]/25 bg-[var(--app-gold)]/10 text-[var(--app-gold-soft)]">
                사주 · 기본 풀이 2/2
              </Badge>
              <Badge className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]">
                {formatBirthSummary(input)}
              </Badge>
            </>
          }
          title="기운 균형"
          description="다섯 기운이 어디에 몰리고 무엇을 채우면 좋은지 한눈에 정리합니다."
        />

        <SwipeSectionDeck
          title="다섯 기운을 쉽게 봅니다"
          description="원형 차트와 간단한 카드로 강한 쪽과 채울 쪽을 먼저 보여드립니다."
        >
          <SwipeSectionSlide
            eyebrow="균형"
            title="다섯 기운의 배치"
            description="막대 합계보다 배치와 간격을 먼저 확인합니다."
            navLabel="균형"
          >
            <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
              <section className="app-hero-card app-section-frame-lg overflow-hidden">
            <div className="app-starfield" />
            <div className="relative z-10">
              <div className="app-caption">다섯 기운의 배치</div>
              <h2 className="mt-3 text-3xl font-black leading-tight text-[var(--app-ink)] sm:text-[2.35rem]">
                {ELEMENT_INFO[dominant].name}이 중심을 잡고, {ELEMENT_INFO[weakest].name}을 채우는 구조입니다
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-8 text-[var(--app-copy)]">
                점수보다 중요한 건 어디에 힘이 몰리고 무엇을 채우면 편해지는지입니다.
                그래서 막대 대신 원형 배치로 먼저 보여드립니다.
              </p>
              <div className="mt-8">
                <FiveElementOrbitChart
                  byElement={sajuData.fiveElements.byElement}
                  dominant={dominant}
                  weakest={weakest}
                />
              </div>
            </div>
          </section>

          <SupportRail
            eyebrow="한눈에 읽는 균형 메모"
            title="지금은 이렇게 채우면 편해집니다"
            description={`${ELEMENT_INFO[dominant].name}의 리듬이 먼저 서고, ${ELEMENT_INFO[weakest].name} 쪽은 상대적으로 비어 있습니다. ${supportGuide.support}`}
            surface="muted"
          >
            <div className="grid gap-3">
              <FeatureCard
                eyebrow="강한 쪽"
                title={ELEMENT_INFO[dominant].name}
                description={`${ELEMENT_INFO[dominant].traits.slice(0, 2).join(' · ')} 쪽 장점이 먼저 드러납니다.`}
                surface="soft"
              />
              <FeatureCard
                eyebrow="채울 쪽"
                title={supportGuide.label}
                description={`${ELEMENT_INFO[weakest].name}을 채우는 방향으로 생활 리듬을 잡을수록 해석이 훨씬 편안하게 읽힙니다.`}
                surface="soft"
              />
              <FeatureCard
                eyebrow="작은 습관"
                title="생활에서 먼저 써볼 것"
                description={
                  <div className="grid gap-2">
                    {supportGuide.habits.map((habit) => (
                      <div
                        key={habit}
                        className="rounded-[0.95rem] border border-[var(--app-line)] bg-[rgba(255,255,255,0.03)] px-3 py-3 text-sm leading-7 text-[var(--app-copy)]"
                      >
                        {habit}
                      </div>
                    ))}
                  </div>
                }
                surface="soft"
              />
            </div>
              </SupportRail>
            </section>
          </SwipeSectionSlide>

          <SwipeSectionSlide
            eyebrow="기운별"
            title="각 기운의 비중과 다음 선택"
            description="강한 쪽과 채울 쪽을 카드로 다시 정리합니다."
            navLabel="기운별"
          >
            <ProductGrid columns={3}>
          {ELEMENT_ORDER.map((element) => {
            const value = sajuData.fiveElements.byElement[element];
            const isDominant = dominant === element;
            const isWeakest = weakest === element;

            return (
              <FeatureCard
                key={element}
                eyebrow={isDominant ? '강한 쪽' : isWeakest ? '채울 쪽' : '분포'}
                title={`${ELEMENT_INFO[element].name} ${Math.round(value.percentage)}%`}
                description={`${ELEMENT_INFO[element].traits.slice(0, 2).join(' · ')} 기운이 ${value.state} 흐름으로 나타납니다.`}
                surface={isDominant ? 'panel' : 'muted'}
                badge={
                  <span
                    className="rounded-full border px-3 py-1 text-[11px]"
                    style={{
                      borderColor: `${ELEMENT_INFO[element].color}55`,
                      color: ELEMENT_INFO[element].color,
                      backgroundColor: `${ELEMENT_INFO[element].color}18`,
                    }}
                  >
                    {ELEMENT_INFO[element].keywords.slice(0, 2).join(' · ')}
                  </span>
                }
              />
            );
          })}
            </ProductGrid>

            <section className="flex flex-wrap gap-3">
          <Link
            href={`/saju/${slug}/nature`}
            className="moon-action-muted"
          >
            이전
          </Link>
          <Link
            href={`/saju/${slug}/premium`}
            className="moon-action-secondary"
          >
            다음: 깊은 사주풀이
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
            </section>
          </SwipeSectionSlide>
        </SwipeSectionDeck>
      </AppPage>
    </AppShell>
  );
}
