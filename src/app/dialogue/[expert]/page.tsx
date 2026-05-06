import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { DialogueChatPanel } from '@/components/dialogue/dialogue-chat-panel';
import { GangiCharacter } from '@/components/gangi/gangi-ui';
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
  }>;
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
    title: `${meta.animal} 선생 대화방`,
    description: `${meta.label}에 맞춰 궁금한 일을 바로 물어보는 달빛인생 대화방입니다.`,
    alternates: { canonical: `/dialogue/${expertId}` },
  };
}

export default async function DialogueExpertRoomPage({ params, searchParams }: Props) {
  const [{ expert }, query] = await Promise.all([params, searchParams]);
  const expertId = normalizeDialogueExpertId(expert);

  if (!expertId) notFound();

  const meta = getDialogueExpertMeta(expertId);
  const teacherName = `${meta.animal} 선생`;

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
              <h1>{teacherName}</h1>
              <p>
                <span aria-hidden="true" />
                응답 중
              </p>
            </div>
          </div>
          <span aria-hidden="true" />
        </header>

        <DialogueChatPanel
          presets={DIALOGUE_PRESETS.map((p) => ({
            category: p.category,
            question: p.question,
          }))}
          initialQuestion={query.question}
          sourceSessionId={query.sourceSessionId}
          concernId={query.concern}
          entrySource={query.from}
          autoStart={query.autoStart === '1'}
          initialExpertId={expertId}
          roomMode
        />
      </AppPage>
    </AppShell>
  );
}
