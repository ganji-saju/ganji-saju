// Redesign 2026-05-17 — expert 별 대화 채팅 페이지. UI 는 DialogueChatPanel
// client component 안에 있고 server page 는 expert resolve + entitlement + 채팅
// panel mount. design token (var(--app-*)) 사용, sibling /dialogue/history 와 통일.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { SafetyNotice } from '@/components/common/safety-notice';
import { DialogueChatPanel } from '@/components/dialogue/dialogue-chat-panel';
import { type ZodiacKey } from '@/components/gangi/zodiac-chip';
import { GuardianAvatar } from '@/components/gangi/guardian-avatar';
import { DIALOGUE_PRESETS } from '@/content/moonlight';
import SiteHeader from '@/features/shared-navigation/site-header';
import {
  DIALOGUE_EXPERTS,
  getDialogueExpertMeta,
  normalizeDialogueExpertId,
} from '@/lib/dialogue-experts';
import { guardLockedFreeEntry } from '@/lib/paywall-lockdown.server';
import { guardMenuPassEntry } from '@/lib/payments/menu-pass.server';
import { getViewerDialogueQuota } from '@/lib/credits/dialogue-quota.server';
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
      description: '간지사주 12지신 대화방입니다.',
    };
  }

  const meta = getDialogueExpertMeta(expertId);

  return {
    title: `${meta.teacherName} 대화방`,
    description: `${meta.label}에 맞춰 궁금한 일을 바로 물어보는 간지사주 대화방입니다.`,
    alternates: { canonical: `/dialogue/${expertId}` },
  };
}

export default async function DialogueExpertRoomPage({ params, searchParams }: Props) {
  const [{ expert }, query] = await Promise.all([params, searchParams]);
  const expertId = normalizeDialogueExpertId(expert);

  if (!expertId) notFound();

  // 전면 유료화 잠금 — 채팅방 진입 차단(멤버십·이용권·전 잔액 있으면 통과).
  //   ⚠️ 여기가 유료 대화(전 차감)도 일어나는 화면이라, 결제자 통과가 반드시 붙어야 한다.
  await guardLockedFreeEntry();
  // 2026-08-25 — 990원 라이트 언락(대화상담).
  await guardMenuPassEntry('dialogue', 'dialogue-room');

  const meta = getDialogueExpertMeta(expertId);
  // 게이트를 통과한 뒤 읽는다 — 통과 못 하면 어차피 체크아웃으로 나간다.
  const quota = await getViewerDialogueQuota();

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell gangi-chat-room-shell pb-24 md:pb-10">
      <AppPage className="gangi-subpage gangi-chat-room-page">
        {/* Redesign 2026-05-13: mockup screens-b.jsx ScreenDialogue 헤더.
            2026-05-16: `.gangi-sub-header` 3-column grid 와 4-element flex 가 충돌해
            teacher info 컬럼이 3.25rem 셀로 짜부, "풀이 응답 중" 텍스트가 줄바꿈
            됐다. 해당 클래스 제거하고 sticky/border 만 Tailwind 로 명시. */}
        <header
          className="gangi-chat-room-top sticky top-0 z-20 flex items-center gap-3 border-b border-[var(--app-line)] bg-white"
          style={{ padding: '12px 14px' }}
        >
          {/* 🔴 2026-08-28 — 전엔 href="/dialogue"(선생 목록)였다. 허브를 없애고 /dialogue 를
              이 방으로 보내는 리다이렉트로 바꿨으므로, 그대로 두면 뒤로가기가 같은 방으로
              되돌아온다. 목록이 없어졌으니 뒤는 홈이다. */}
          <Link
            href="/"
            aria-label="홈으로"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--app-line)] bg-white"
          >
            <ArrowLeft className="h-4 w-4 text-[var(--app-copy)]" />
          </Link>
          {/* 2026-08-26 — 대화 상대는 '표식'이 아니라 '얼굴'이다. 인장 chip → 수호신 초상(미소). */}
          <GuardianAvatar zodiac={expertId as ZodiacKey} mood="smile" size="sm" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[16.7px] font-extrabold tracking-tight text-[var(--app-ink)]">
              {meta.teacherName}
            </h1>
            <p className="mt-0.5 flex items-center gap-1 whitespace-nowrap text-[12.6px] font-bold text-[var(--app-jade)]">
              <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--app-jade)]" />
              풀이 응답 중
            </p>
          </div>
          <button
            type="button"
            aria-label="더보기"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--app-line)] bg-white text-[17.3px] font-bold text-[var(--app-copy-muted)]"
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
          initialQuestionsRemaining={quota?.remaining ?? null}
        />

        {/* 🔴 2026-08-28 — 위기 안내(SafetyNotice crisis)는 없앤 허브가 **유일한 노출처**였다.
            대화가 실제로 일어나는 곳은 여기라, 허브와 함께 사라지게 두면 안 된다. */}
        <div className="px-3 pb-4 pt-3">
          <SafetyNotice variant="crisis" />
        </div>
      </AppPage>
    </AppShell>
  );
}
