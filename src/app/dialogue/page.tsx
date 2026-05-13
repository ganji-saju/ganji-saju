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
  title: '대화',
  description: '달빛인생 대화방에서 궁금한 일을 바로 물어보세요.',
  alternates: { canonical: '/dialogue' },
};

const RECOMMENDED_EXPERT_IDS = ['dragon', 'rat', 'sheep', 'ox'] as const;

function buildExpertItem(expert: (typeof DIALOGUE_EXPERTS)[number]) {
  return {
    id: expert.id,
    title: expert.teacherName,
    description: `${expert.label} · ${expert.description}`,
    href: `/dialogue/${expert.id}`,
    badge: expert.topic,
    meta: '선택',
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
          eyebrow="AI Dialogue"
          title="풀이를 보고 더 묻고 싶을 때"
          description="추천 선생님을 먼저 고르고, 필요하면 전체 분야에서 더 좁혀 물어보세요."
          actions={
            <Link href="/saju/personality" className="gangi-primary-button">
              성향사주 보고 묻기
            </Link>
          }
        />

        <LightSection
          eyebrow="추천 선생님"
          title="자주 이어지는 질문 4가지"
          description="사주, 성향, 관계, 오늘 흐름을 먼저 열어둡니다."
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
          eyebrow="전체 선생님"
          title="더 좁혀서 묻기"
          description="필요할 때만 펼쳐보는 compact list입니다."
        >
          <details>
            <summary className="cursor-pointer rounded-[1rem] border border-[var(--gyeol-line)] bg-[var(--gyeol-surface)] px-4 py-3 text-sm font-bold text-[var(--gyeol-text)]">
              12간지 전체 분야 보기
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
          대화방은 사주와 성향 콘텐츠를 바탕으로 생각을 정리하는 참고용 상담입니다. 위기상황,
          의료·법률·투자 판단은 전문 도움을 우선해 주세요.
        </SafetyNotice>
      </AppPage>
    </AppShell>
  );
}
