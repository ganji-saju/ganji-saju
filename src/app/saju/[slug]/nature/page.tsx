import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import {
  GangiActionRow,
  GangiIntro,
  GangiMiniCard,
  GangiPageHeader,
  GangiSection,
} from '@/components/gangi/gangi-ui';
import SajuScreenNav from '@/features/saju-detail/saju-screen-nav';
import { formatBirthSummary } from '@/features/saju-detail/saju-screen-helpers';
import SiteHeader from '@/features/shared-navigation/site-header';
import { ELEMENT_INFO } from '@/lib/saju/elements';
import { resolveReading } from '@/lib/saju/readings';
import type { Element } from '@/lib/saju/types';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

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
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell">
      <AppPage className="gangi-subpage saju-readable-page space-y-5 pb-24">
        <GangiPageHeader title="성향" backHref={`/saju/${slug}/overview`} />
        <SajuScreenNav slug={slug} current="nature" />

        <GangiIntro
          eyebrow="타고난 성향"
          title={`${metaphor}처럼 드러나는 나`}
          description={
            <>
              장점이 살아나는 장면과 조심할 점만 짧게 봅니다.
              <br />
              <span>{formatBirthSummary(input)}</span>
            </>
          }
        />

        <GangiSection
          eyebrow="핵심"
          title="내 장점이 살아나는 장면"
          description={guide.strength}
        >
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
          <p className="mt-4 text-sm leading-8 text-[var(--app-copy)]">{description}</p>
        </GangiSection>

        <GangiSection
          eyebrow="생활 힌트"
          title="이렇게 쓰면 더 편해요"
        >
          <div className="grid grid-cols-2 gap-3">
            <GangiMiniCard label="사람 앞에서는" title="힘이 붙는 장면" desc={guide.social} />
            <GangiMiniCard label="흔들릴 때" title="먼저 거칠어질 수 있어요" desc={guide.caution} />
            <GangiMiniCard label="균형 메모" title="장점을 오래 쓰는 법" desc={guide.support} />
            <GangiMiniCard label="잘 맞는 분위기" title={ELEMENT_INFO[element].name} desc={seasonHints} />
          </div>
        </GangiSection>

        <GangiSection
          tone="pink"
          eyebrow="다음"
          title="기운 균형도 이어서 볼 수 있어요"
          description="강한 쪽과 채우면 편한 쪽을 원형으로 확인합니다."
        >
          <GangiActionRow>
            <Link href={`/saju/${slug}/elements`} className="gangi-primary-button">
              기운 균형 보기 <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href={`/saju/${slug}/overview`} className="gangi-secondary-button">
              내 사주로 돌아가기
            </Link>
          </GangiActionRow>
        </GangiSection>
      </AppPage>
    </AppShell>
  );
}
