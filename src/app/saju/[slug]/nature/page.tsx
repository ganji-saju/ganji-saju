import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { SupportRail } from '@/components/layout/support-rail';
import { SwipeSectionDeck, SwipeSectionSlide } from '@/components/layout/swipe-section-deck';
import { Badge } from '@/components/ui/badge';
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

const NATURE_GUIDE: Record<
  Element,
  {
    strength: string;
    social: string;
    caution: string;
    support: string;
  }
> = {
  목: {
    strength: '사람과 일의 방향을 열고, 흐름을 바깥으로 자라게 하는 힘이 큽니다.',
    social: '아이디어를 먼저 꺼내거나 주변 사람을 북돋우는 자리에서 존재감이 살아납니다.',
    caution: '가능성을 넓게 보느라 해야 할 일을 너무 많이 벌리면 마무리가 흐려질 수 있습니다.',
    support: '우선순위를 먼저 좁히고, 하나를 끝낸 뒤 다음으로 넘어가면 장점이 더 또렷해집니다.',
  },
  화: {
    strength: '분위기를 밝히고 사람의 마음을 움직이게 하는 추진력이 분명합니다.',
    social: '감정을 실어 표현하거나 직접 앞장서는 순간에 힘이 빠르게 붙는 편입니다.',
    caution: '속도가 붙을수록 말이 먼저 나가거나 결론을 서둘러 단정할 수 있습니다.',
    support: '결정 전 한 템포 쉬고, 감정과 판단을 나눠 말하면 빛이 더 오래 갑니다.',
  },
  토: {
    strength: '사람과 일을 한가운데서 묶고 중심을 잡는 안정감이 강한 편입니다.',
    social: '누군가를 안심시키거나 흩어진 상황을 정리할 때 신뢰가 크게 붙습니다.',
    caution: '책임감이 커질수록 혼자 다 떠안거나, 변화 속도를 늦춰 답답함을 줄 수 있습니다.',
    support: '내가 맡을 몫과 내려둘 몫을 나누면 중심감은 살고 피로는 줄어듭니다.',
  },
  금: {
    strength: '정리하고, 결론을 또렷하게 만드는 힘이 가장 돋보입니다.',
    social: '모호한 장면에서 방향을 정리하거나, 필요한 선을 분명히 할 때 믿음을 줍니다.',
    caution: '판단이 날카로워질수록 사람의 감정보다 결과를 먼저 보고 차갑게 읽힐 수 있습니다.',
    support: '결론 앞에 맥락 한 줄을 먼저 두면 강한 판단이 부드럽게 받아들여집니다.',
  },
  수: {
    strength: '큰 흐름을 읽고 여지를 남기며 움직이는 포용력과 기획력이 살아 있습니다.',
    social: '사람의 속마음이나 상황의 결을 길게 읽을 때 오히려 더 정확해집니다.',
    caution: '생각이 깊어질수록 결론을 늦추거나 감정 표현을 아끼는 쪽으로 흐를 수 있습니다.',
    support: '머릿속 판단을 한 문장으로 먼저 꺼내는 습관이 기질의 장점을 더 빨리 살립니다.',
  },
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '타고난 성향',
    description: '타고난 성향을 쉬운 말로 확인하는 화면입니다.',
    robots: { index: false, follow: false },
  };
}

export default async function SajuNaturePage({ params }: Props) {
  const { slug } = await params;
  const reading = await resolveReading(slug);

  if (!reading) notFound();

  const { input, sajuData } = reading;
  const metaphor = sajuData.dayMaster.metaphor ?? '자연의 상징';
  const description =
    sajuData.dayMaster.description ??
    '선생님의 기질은 자연의 리듬처럼 밝음과 고요함이 함께 흐르는 모습입니다.';
  const element = sajuData.dayMaster.element;
  const guide = NATURE_GUIDE[element];
  const traits = ELEMENT_INFO[element].traits.slice(0, 3);
  const seasonHints = ELEMENT_INFO[element].keywords.slice(0, 3).join(' · ');

  return (
    <AppShell header={<SiteHeader />}>
      <AppPage className="space-y-6">
        <SajuScreenNav slug={slug} current="nature" />

        <PageHero
          badges={
            <>
              <Badge className="border-[var(--app-gold)]/25 bg-[var(--app-gold)]/10 text-[var(--app-gold-soft)]">
                사주 · 기본 풀이 1/2
              </Badge>
              <Badge className="border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-muted)]">
                {formatBirthSummary(input)}
              </Badge>
            </>
          }
          title="타고난 성향"
          description="내 장점이 잘 살아나는 장면과 감정이 앞설 때 조심할 점을 먼저 봅니다."
        />

        <SwipeSectionDeck
          title="내 성향을 쉽게 정리합니다"
          description="타고난 기질, 사람 앞에서 드러나는 모습, 다음 행동을 간단히 나눠 봅니다."
        >
          <SwipeSectionSlide
            eyebrow="기질"
            title="타고난 성향 핵심"
            description="내 장점과 조심할 점을 먼저 확인합니다."
            navLabel="기질"
          >
            <section className="grid gap-6 xl:grid-cols-[1.06fr_0.94fr]">
              <SectionSurface surface="hero" size="lg" className="overflow-hidden">
            <div className="app-starfield" />
            <div className="relative z-10 grid gap-6 lg:grid-cols-[0.38fr_0.62fr] lg:items-center">
              <div className="rounded-[1.75rem] border border-[var(--app-pink-line)] bg-white px-5 py-6 text-center shadow-[0_18px_42px_rgba(216,27,114,0.1)]">
                <div className="mx-auto flex h-22 w-22 items-center justify-center rounded-full border border-[var(--app-pink-line)] bg-[var(--app-pink-soft)] text-2xl font-black text-[var(--app-pink-strong)]">
                  {ELEMENT_INFO[element].traits[0]}
                </div>
                <div className="mt-4 text-base font-black text-[var(--app-ivory)]">
                  {ELEMENT_INFO[element].name}
                </div>
                <div className="mt-2 text-xs font-semibold text-[var(--app-copy-muted)]">
                  {metaphor}
                </div>
              </div>

              <div className="space-y-5">
                <SectionHeader
                  eyebrow="성향 비유"
                  title={`${metaphor}처럼 드러나는 기질`}
                  description={guide.strength}
                  titleClassName="text-3xl sm:text-[2.2rem]"
                />
                <div className="flex flex-wrap gap-2">
                  {traits.map((trait) => (
                    <span
                      key={trait}
                      className="rounded-full border border-[var(--app-pink-line)] bg-[var(--app-pink-soft)] px-3 py-1 text-xs font-semibold text-[var(--app-pink-strong)]"
                    >
                      {trait}
                    </span>
                  ))}
                </div>
                <div className="rounded-[1.2rem] border border-[var(--app-line)] bg-[rgba(255,255,255,0.04)] px-5 py-5 text-sm leading-8 text-[var(--app-copy)]">
                  {description}
                </div>
              </div>
            </div>
          </SectionSurface>

          <SupportRail
            eyebrow="생활 힌트"
            title="사람 앞에서 어떻게 드러나는지 먼저 봅니다"
            description="성향 화면은 길게 설명하기보다, 언제 힘이 붙고 언제 감정이 먼저 나가는지를 먼저 짚은 뒤 기운 균형으로 이어집니다."
            surface="muted"
          >
            <div className="grid gap-3">
              <FeatureCard
                eyebrow="사람 앞에서는"
                title="이런 장면에서 힘이 붙습니다"
                description={guide.social}
                surface="soft"
              />
              <FeatureCard
                eyebrow="흔들릴 때"
                title="이 부분이 먼저 거칠어질 수 있습니다"
                description={guide.caution}
                surface="soft"
              />
              <FeatureCard
                eyebrow="균형 메모"
                title="이렇게 쓰면 장점이 더 오래 갑니다"
                description={guide.support}
                surface="soft"
              />
            </div>
              </SupportRail>
            </section>
          </SwipeSectionSlide>

          <SwipeSectionSlide
            eyebrow="정리"
            title="생활 리듬과 다음 화면"
            description="성향 키워드와 다음 기운 균형 화면으로 이어지는 선택을 모았습니다."
            navLabel="정리"
          >
            <ProductGrid columns={3}>
          <FeatureCard
            eyebrow="성향 키워드"
            title={`${ELEMENT_INFO[element].name}의 느낌`}
            description={`이 기질은 ${traits.join(' · ')} 쪽으로 강점을 보입니다.`}
            surface="panel"
          />
          <FeatureCard
            eyebrow="생활 리듬"
            title="잘 맞는 분위기"
            description={`계절과 공간의 언어로 보면 ${seasonHints} 쪽에서 마음이 풀리기 쉽습니다.`}
            surface="panel"
          />
          <FeatureCard
            eyebrow="다음 화면"
            title="기운 균형으로 이어집니다"
            description="성향이 어떻게 드러나는지 읽었다면, 다음 화면에서는 다섯 기운의 배치를 원형으로 확인합니다."
            surface="panel"
            footer={
              <Link
                href={`/saju/${slug}/elements`}
                className="inline-flex items-center gap-2 text-sm font-medium text-[var(--app-gold-text)] underline underline-offset-4 hover:text-[var(--app-ivory)]"
              >
                기운 균형 보기
                <ArrowRight className="h-4 w-4" />
              </Link>
            }
          />
            </ProductGrid>

            <section className="flex flex-wrap gap-3">
          <Link
            href={`/saju/${slug}/overview`}
            className="moon-action-muted"
          >
            이전
          </Link>
          <Link
            href={`/saju/${slug}/elements`}
            className="moon-action-secondary"
          >
            다음: 기운 균형
          </Link>
            </section>
          </SwipeSectionSlide>
        </SwipeSectionDeck>
      </AppPage>
    </AppShell>
  );
}
