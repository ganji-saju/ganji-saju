import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FlowEntryList } from '@/components/moonlight/FlowEntryList';
import { LightSection } from '@/components/moonlight/LightSection';
import { PageIntro } from '@/components/moonlight/PageIntro';
import { SafetyNotice } from '@/components/moonlight/SafetyNotice';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import {
  DIALOGUE_EXPERTS,
  normalizeDialogueExpertId,
} from '@/lib/dialogue-experts';

export const metadata: Metadata = {
  title: '12간지 대화방',
  description: '달빛인생 12간지 캐릭터와 사주와 성향의 결을 이어 물어보세요.',
  alternates: { canonical: '/dialogue' },
};

const RECOMMENDED_EXPERT_IDS = ['rat', 'rabbit', 'dragon'] as const;

function buildExpertItem(expert: (typeof DIALOGUE_EXPERTS)[number]) {
  return {
    id: expert.id,
    title: expert.teacherName,
    description: `${expert.label} · ${expert.description}`,
    href: `/dialogue/${expert.id}`,
    badge: expert.topic,
    meta: '대화',
  };
}

export default async function DialoguePage({
  searchParams,
}: {
  searchParams: Promise<{
    question?: string;
    sourceSessionId?: string;
    concern?: string;
    from?: string;
    autoStart?: string;
    expert?: string;
    sajuPersonalityReportId?: string;
    lifeArea?: string;
  }>;
}) {
  const params = await searchParams;
  const selectedExpertId = normalizeDialogueExpertId(params.expert) ?? 'dragon';
  const shouldOpenRoom = Boolean(
    params.expert ||
      params.question ||
      params.sourceSessionId ||
      params.concern ||
      params.from ||
      params.autoStart ||
      params.sajuPersonalityReportId
  );

  if (shouldOpenRoom) {
    const nextParams = new URLSearchParams();

    if (params.question) nextParams.set('question', params.question);
    if (params.sourceSessionId) nextParams.set('sourceSessionId', params.sourceSessionId);
    if (params.concern) nextParams.set('concern', params.concern);
    if (params.from) nextParams.set('from', params.from);
    if (params.autoStart) nextParams.set('autoStart', params.autoStart);
    if (params.sajuPersonalityReportId) {
      nextParams.set('sajuPersonalityReportId', params.sajuPersonalityReportId);
    }
    if (params.lifeArea) nextParams.set('lifeArea', params.lifeArea);

    const query = nextParams.toString();
    redirect(`/dialogue/${selectedExpertId}${query ? `?${query}` : ''}`);
  }

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-0">
      <AppPage className="gangi-subpage space-y-6">
        <GangiPageHeader title="대화방" />
        <PageIntro
          eyebrow="12 Zodiac Dialogue"
          title="12간지 캐릭터와 대화하기"
          description="사주와 성향의 결을 캐릭터별 관점으로 풀어봅니다. 자축인묘 12간지 캐릭터가 질문의 방향을 함께 잡아드려요."
          actions={
            <Link href="/saju/personality" className="gangi-primary-button">
              성향사주 보고 묻기
            </Link>
          }
        />

        <LightSection
          eyebrow="오늘의 추천 간지"
          title="지금 많이 이어지는 질문 3가지"
          description="오늘의 흐름, 관계의 말투, 큰 방향을 먼저 열어둡니다."
          surface="soft"
        >
          <FlowEntryList
            items={DIALOGUE_EXPERTS.filter((expert) =>
              RECOMMENDED_EXPERT_IDS.includes(expert.id as (typeof RECOMMENDED_EXPERT_IDS)[number])
            ).map((expert) => ({
              ...buildExpertItem(expert),
              meta: selectedExpertId === expert.id ? '선택됨' : '시작',
            }))}
          />
        </LightSection>

        <LightSection
          eyebrow="전체 12간지"
          title="캐릭터별 관점으로 더 좁혀 묻기"
          description="이미지가 없어도 한자와 동물 이름으로 가볍게 선택할 수 있는 compact list입니다."
        >
          <details>
            <summary className="cursor-pointer rounded-[1rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-surface)] px-4 py-3 text-sm font-bold text-[var(--gyeol-text)]">
              전체 12간지 보기
            </summary>
            <FlowEntryList
              className="mt-3"
              items={DIALOGUE_EXPERTS.map((expert) => ({
                ...buildExpertItem(expert),
                meta: selectedExpertId === expert.id ? '선택됨' : '열기',
              }))}
            />
          </details>
        </LightSection>

        <SafetyNotice>
          12간지 대화방은 사주와 성향 콘텐츠를 바탕으로 생각을 정리하는 참고용 상담입니다. 위기상황,
          의료·법률·투자 판단은 전문 도움을 우선해 주세요.
        </SafetyNotice>
      </AppPage>
    </AppShell>
  );
}
