import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { DialogueChatPanel } from '@/components/dialogue/dialogue-chat-panel';
import { ZodiacChip, type ZodiacKey } from '@/components/gangi/zodiac-chip';
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

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell gangi-chat-room-shell pb-24 md:pb-10">
      <AppPage className="gangi-subpage gangi-chat-room-page">
        {/* Redesign 2026-05-13: mockup screens-b.jsx ScreenDialogue 헤더 */}
        <header
          className="gangi-sub-header gangi-chat-room-top flex items-center gap-3"
          style={{ padding: '12px 14px', background: '#fff' }}
        >
          <Link
            href="/dialogue"
            aria-label="대화방 목록으로"
            className="grid h-9 w-9 place-items-center rounded-full border border-[var(--app-line)] bg-white"
          >
            <ArrowLeft className="h-4 w-4 text-[var(--app-copy)]" />
          </Link>
          <ZodiacChip kind={expertId as ZodiacKey} size="sm" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[14.5px] font-extrabold tracking-tight text-[var(--app-ink)]">
              {meta.teacherName}
            </h1>
            <p className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-[var(--app-jade)]">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--app-jade)]" />
              풀이 응답 중
            </p>
          </div>
          <button
            type="button"
            aria-label="더보기"
            className="grid h-9 w-9 place-items-center rounded-full border border-[var(--app-line)] bg-white text-[15px] font-bold text-[var(--app-copy-muted)]"
          >
            ⋯
          </button>
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
