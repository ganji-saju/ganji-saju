import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SafetyNotice } from '@/components/common/safety-notice';
import { SectionHeader } from '@/components/layout/section-header';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { GangiCharacter, GangiIntro, GangiPageHeader } from '@/components/gangi/gangi-ui';
import {
  DIALOGUE_EXPERTS,
  normalizeDialogueExpertId,
} from '@/lib/dialogue-experts';

export const metadata: Metadata = {
  title: '대화',
  description: '달빛인생 대화방에서 궁금한 일을 바로 물어보세요.',
  alternates: { canonical: '/dialogue' },
};

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
      params.autoStart
  );

  if (shouldOpenRoom) {
    const nextParams = new URLSearchParams();

    if (params.question) nextParams.set('question', params.question);
    if (params.sourceSessionId) nextParams.set('sourceSessionId', params.sourceSessionId);
    if (params.concern) nextParams.set('concern', params.concern);
    if (params.from) nextParams.set('from', params.from);
    if (params.autoStart) nextParams.set('autoStart', params.autoStart);

    const query = nextParams.toString();
    redirect(`/dialogue/${selectedExpertId}${query ? `?${query}` : ''}`);
  }

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-0">
      <AppPage className="gangi-subpage space-y-6">
        <GangiPageHeader title="대화방" />
        <GangiIntro
          title={
            <>
              어떤 선생님과
              <br />
              이야기 나눠볼까요?
            </>
          }
          description="분야를 고르고 바로 물어보세요."
        />

        <section className="gangi-card-panel p-5">
          <SectionHeader
            eyebrow="12간지 전문 분야"
            title="무엇을 물어볼까요?"
            titleClassName="text-2xl"
          />
          <div className="mt-5 flex flex-col gap-2.5">
            {DIALOGUE_EXPERTS.map((expert) => (
              <Link
                key={expert.id}
                href={`/dialogue/${expert.id}`}
                className="gangi-list-link"
                data-active={selectedExpertId === expert.id}
              >
                <GangiCharacter zodiac={expert.id} />
                <span className="gangi-list-copy">
                  <strong>
                    {expert.teacherName}
                  </strong>
                  <em>{expert.label} · {expert.description}</em>
                </span>
                <span className="gangi-list-price">
                  {selectedExpertId === expert.id ? '선택됨' : '선택'}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <SafetyNotice variant="crisis" />
        </section>
      </AppPage>
    </AppShell>
  );
}
