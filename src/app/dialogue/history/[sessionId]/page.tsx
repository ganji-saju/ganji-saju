// 2026-05-15 — 특정 대화 세션의 전체 메시지 보기.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { ZodiacChip, type ZodiacKey } from '@/components/gangi/zodiac-chip';
import SiteHeader from '@/features/shared-navigation/site-header';
import { getDialogueSessionMessages } from '@/lib/dialogue/history';
import { getDialogueExpertMeta, normalizeDialogueExpertId } from '@/lib/dialogue-experts';
import { createClient } from '@/lib/supabase/server';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

interface Props {
  params: Promise<{ sessionId: string }>;
}

export const metadata: Metadata = {
  title: '대화 다시 보기',
  robots: { index: false, follow: false },
};

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

export default async function DialogueHistorySessionPage({ params }: Props) {
  const { sessionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // 비로그인 — 히스토리 없음, 로그인 유도.
    return (
      <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
        <AppPage className="gangi-subpage saju-result-page space-y-5">
          <GangiPageHeader title="대화 다시 보기" backHref="/dialogue/history" />
          <article
            className="rounded-[18px] border bg-white p-5 text-center"
            style={{ borderColor: 'var(--app-pink-line)' }}
          >
            <div className="text-[32px]">🔒</div>
            <p className="mt-2 text-[13px] text-[var(--app-copy-muted)]">로그인 후 다시 시도해주세요.</p>
            <Link
              href={`/login?next=%2Fdialogue%2Fhistory%2F${sessionId}`}
              className="mt-4 inline-flex items-center justify-center rounded-full bg-[var(--app-pink)] px-5 py-3 text-[13px] font-extrabold text-white"
            >
              로그인 →
            </Link>
          </article>
        </AppPage>
      </AppShell>
    );
  }

  const messages = await getDialogueSessionMessages(supabase, user.id, sessionId);
  if (messages.length === 0) notFound();

  const expertId = normalizeDialogueExpertId(messages[0]!.expert_id) ?? 'dragon';
  const meta = getDialogueExpertMeta(expertId);

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="대화 다시 보기" backHref="/dialogue/history" />

        <section className="space-y-5 px-1">
          {/* §Hero — 선생님 */}
          <article
            className="rounded-[18px] border bg-white p-5"
            style={{ borderColor: 'var(--app-pink-line)' }}
          >
            <div className="flex items-center gap-3">
              <ZodiacChip kind={expertId as ZodiacKey} size="md" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                  대화 상대
                </div>
                <div className="text-[16px] font-extrabold text-[var(--app-ink)]">
                  {meta.teacherName}
                </div>
                <div className="mt-0.5 text-[11px] text-[var(--app-copy-soft)]">
                  메시지 {messages.length}개 · {formatTime(messages[0]!.created_at)} 시작
                </div>
              </div>
            </div>
          </article>

          {/* §Messages — 채팅 흐름 (오래된 순) */}
          <section>
            <h2 className="px-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-muted)]">
              대화 내용
            </h2>
            <div className="mt-2 grid gap-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className="max-w-[85%] rounded-[14px] px-4 py-3"
                    style={
                      msg.role === 'user'
                        ? {
                            background: 'var(--app-pink)',
                            color: 'white',
                            borderTopRightRadius: 4,
                          }
                        : {
                            background: 'white',
                            border: '1px solid var(--app-line)',
                            color: 'var(--app-ink)',
                            borderTopLeftRadius: 4,
                          }
                    }
                  >
                    <p
                      className="text-[13px] leading-[1.65] whitespace-pre-wrap"
                      style={{ wordBreak: 'keep-all' }}
                    >
                      {msg.text}
                    </p>
                    <div
                      className="mt-1.5 text-[10px] font-bold"
                      style={{
                        opacity: 0.7,
                        color: msg.role === 'user' ? 'white' : 'var(--app-copy-soft)',
                      }}
                    >
                      {formatTime(msg.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* §CTA — 같은 선생님과 새 대화 */}
          <article
            className="rounded-[18px] p-5 text-white"
            style={{
              background: 'var(--app-ink)',
              boxShadow: '0 18px 44px rgba(15,23,42,0.18)',
            }}
          >
            <div
              className="text-[11px] font-extrabold uppercase tracking-[0.04em]"
              style={{ color: 'var(--app-pink)' }}
            >
              다음 대화
            </div>
            <h2 className="mt-1.5 text-[16px] font-extrabold leading-snug tracking-tight">
              {meta.teacherName}님과 새 대화 시작하기
            </h2>
            <Link
              href={`/dialogue/${expertId}`}
              className="mt-4 inline-flex items-center justify-center rounded-full bg-[var(--app-pink)] px-5 py-3 text-[13.5px] font-extrabold text-white"
            >
              대화방 열기 →
            </Link>
          </article>
        </section>
      </AppPage>
    </AppShell>
  );
}
