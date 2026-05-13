import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { DialogueChatPanel } from '@/components/dialogue/dialogue-chat-panel';
import { GangiCharacter } from '@/components/gangi/gangi-ui';
import { LightSection } from '@/components/moonlight/LightSection';
import { DIALOGUE_PRESETS } from '@/content/moonlight';
import SiteHeader from '@/features/shared-navigation/site-header';
import {
  DIALOGUE_EXPERTS,
  getDialogueExpertMeta,
  normalizeDialogueExpertId,
} from '@/lib/dialogue-experts';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

interface Props {
  params: Promise<{ expert: string }>;
  searchParams: Promise<{
    question?: string;
    sourceSessionId?: string;
    concern?: string;
    from?: string;
    autoStart?: string;
    sajuPersonalityReportId?: string;
    lifeArea?: string;
  }>;
}

function getContextNotice(query: Awaited<Props['searchParams']>) {
  if (query.sajuPersonalityReportId) {
    return {
      title: '성향사주 결과에서 이어왔어요',
      description: '리포트 ID와 관심영역만 대화 맥락으로 넘기고, 생년월일시 원문은 상단에 표시하지 않습니다.',
    };
  }

  if (query.sourceSessionId && query.from === 'personality-compatibility-result') {
    return {
      title: '성향궁합 결과에서 이어왔어요',
      description: '결과 범위와 질문 흐름만 이어서 보고, 상대 개인정보는 이 안내 영역에 노출하지 않습니다.',
    };
  }

  if (query.sourceSessionId && query.from === 'today-fortune') {
    return {
      title: '오늘운세 결과에서 이어왔어요',
      description: '오늘운세 세션 기준으로 이어 묻습니다. 입력한 생년월일시는 안내 영역에 표시하지 않습니다.',
    };
  }

  if (query.question || query.from || query.sourceSessionId) {
    return {
      title: '이전 화면의 질문 맥락을 이어왔어요',
      description: '질문 원문은 대화 입력에만 전달하고, 상단 안내에는 민감한 내용을 표시하지 않습니다.',
    };
  }

  return null;
}

export function generateStaticParams() {
  return DIALOGUE_EXPERTS.map((expert) => ({ expert: expert.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { expert } = await params;
  const expertId = normalizeDialogueExpertId(expert);

  if (!expertId) {
    return {
      title: '대화방',
      description: '달빛인생 12지신 대화방입니다.',
    };
  }

  const meta = getDialogueExpertMeta(expertId);

  return {
    title: `${meta.teacherName} 대화방`,
    description: `${meta.label}에 맞춰 궁금한 일을 바로 물어보는 달빛인생 대화방입니다.`,
    alternates: { canonical: `/dialogue/${expertId}` },
  };
}

export default async function DialogueExpertRoomPage({ params, searchParams }: Props) {
  const [{ expert }, query] = await Promise.all([params, searchParams]);
  const expertId = normalizeDialogueExpertId(expert);

  if (!expertId) notFound();

  const meta = getDialogueExpertMeta(expertId);
  const contextNotice = getContextNotice(query);

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell gangi-chat-room-shell pb-24 md:pb-10">
      <AppPage className="gangi-subpage gangi-chat-room-page">
        <header className="gangi-sub-header gangi-chat-room-top">
          <Link href="/dialogue" className="gangi-sub-back" aria-label="대화방 목록으로">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <div className="gangi-chat-room-title">
            <GangiCharacter zodiac={expertId} size="sm" />
            <div>
              <h1>{meta.teacherName}</h1>
              <p>
                <span aria-hidden="true" />
                응답 중
              </p>
            </div>
          </div>
          <span aria-hidden="true" />
        </header>

        {contextNotice ? (
          <LightSection
            eyebrow="이어 묻기"
            title={contextNotice.title}
            description={contextNotice.description}
            surface="soft"
            className="mb-4"
          />
        ) : null}

        <DialogueChatPanel
          presets={DIALOGUE_PRESETS.map((p) => ({
            category: p.category,
            question: p.question,
          }))}
          initialQuestion={query.question}
          sourceSessionId={query.sourceSessionId}
          concernId={query.concern}
          entrySource={query.from}
          sajuPersonalityReportId={query.sajuPersonalityReportId}
          sajuPersonalityLifeArea={query.lifeArea}
          autoStart={query.autoStart === '1'}
          initialExpertId={expertId}
          roomMode
        />
      </AppPage>
    </AppShell>
  );
}
