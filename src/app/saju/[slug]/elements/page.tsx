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
import FiveElementOrbitChart from '@/components/saju/five-element-orbit-chart';
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
    support: '급하게 몰아가기보다 여지를 남기고 깊게 읽는 축을 채워주면 균형이 좋아집니다.',
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
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell">
      <AppPage className="gangi-subpage saju-readable-page space-y-5 pb-24">
        <GangiPageHeader title="기운 균형" backHref={`/saju/${slug}/nature`} />
        <SajuScreenNav slug={slug} current="elements" />

        <GangiIntro
          eyebrow="오행 균형"
          title={`${ELEMENT_INFO[dominant].name}이 강하고, ${ELEMENT_INFO[weakest].name}을 채우면 편해요`}
          description={
            <>
              복잡한 점수보다 생활에서 어떤 균형을 잡으면 좋은지 먼저 보여드립니다.
              <br />
              <span>{formatBirthSummary(input)}</span>
            </>
          }
        />

        <GangiSection
          eyebrow="내 기운의 모양"
          title="다섯 기운을 한눈에 봅니다"
          description={`${ELEMENT_INFO[dominant].name}의 리듬이 먼저 서고, ${ELEMENT_INFO[weakest].name} 쪽은 상대적으로 비어 있습니다.`}
        >
          <FiveElementOrbitChart
            byElement={sajuData.fiveElements.byElement}
            dominant={dominant}
            weakest={weakest}
          />
        </GangiSection>

        <GangiSection
          eyebrow="균형 메모"
          title="이렇게 채우면 편해집니다"
          description={supportGuide.support}
        >
          <div className="grid grid-cols-2 gap-3">
            <GangiMiniCard
              label="강한 쪽"
              title={ELEMENT_INFO[dominant].name}
              desc={`${ELEMENT_INFO[dominant].traits.slice(0, 2).join(' · ')} 쪽 장점이 먼저 드러납니다.`}
            />
            <GangiMiniCard
              label="채울 쪽"
              title={supportGuide.label}
              desc={`${ELEMENT_INFO[weakest].name}을 채우는 쪽으로 하루 리듬을 잡아보세요.`}
            />
            {supportGuide.habits.slice(0, 2).map((habit, index) => (
              <GangiMiniCard
                key={habit}
                label={`작은 습관 ${index + 1}`}
                title={habit}
              />
            ))}
          </div>
        </GangiSection>

        <GangiSection
          eyebrow="기운별 보기"
          title="각 기운은 이렇게 분포되어 있어요"
        >
          <div className="grid grid-cols-2 gap-3">
            {ELEMENT_ORDER.map((element) => {
              const value = sajuData.fiveElements.byElement[element];
              const isDominant = dominant === element;
              const isWeakest = weakest === element;

              return (
                <div
                  key={element}
                  className="gangi-mini-card"
                  style={{
                    borderColor: isDominant || isWeakest ? `${ELEMENT_INFO[element].color}55` : undefined,
                  }}
                >
                  <span>{isDominant ? '강한 쪽' : isWeakest ? '채울 쪽' : '분포'}</span>
                  <strong>{ELEMENT_INFO[element].name} {Math.round(value.percentage)}%</strong>
                  <p>{ELEMENT_INFO[element].traits.slice(0, 2).join(' · ')}</p>
                </div>
              );
            })}
          </div>
        </GangiSection>

        <GangiSection
          tone="pink"
          eyebrow="다음"
          title="더 깊게 보고 싶다면"
          description="성향, 올해 흐름, 돈·일·관계 조언을 한 번에 이어서 봅니다."
        >
          <GangiActionRow>
            <Link href={`/saju/${slug}/premium`} className="gangi-primary-button">
              깊은 사주풀이 보기 <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href={`/saju/${slug}/nature`} className="gangi-secondary-button">
              성향으로 돌아가기
            </Link>
          </GangiActionRow>
        </GangiSection>
      </AppPage>
    </AppShell>
  );
}
