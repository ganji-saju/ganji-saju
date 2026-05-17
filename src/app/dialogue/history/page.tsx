// Redesign 2026-05-15 — 대화 채팅 기록 페이지.
// 사용자 피드백: "내 채팅기록이 남는 화면도 없어."
// 사용자별 대화 세션 (expert 별 그룹) 목록 + 첫 질문 + 마지막 응답 미리보기.
import type { Metadata } from 'next';
import Link from 'next/link';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { ZodiacChip, type ZodiacKey } from '@/components/gangi/zodiac-chip';
import SiteHeader from '@/features/shared-navigation/site-header';
import { listDialogueSessions } from '@/lib/dialogue/history';
import { getDialogueExpertMeta, normalizeDialogueExpertId } from '@/lib/dialogue-experts';
import { createClient } from '@/lib/supabase/server';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

export const metadata: Metadata = {
  title: '대화 기록',
  description: '내가 12지신 선생님과 나눈 대화를 다시 볼 수 있는 화면입니다.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/dialogue/history' },
};

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const ts = new Date(iso).getTime();
  const diff = Math.max(0, now - ts);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}일 전`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month}개월 전`;
  return `${Math.floor(month / 12)}년 전`;
}

export default async function DialogueHistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const sessions = user ? await listDialogueSessions(supabase, user.id, { limit: 30 }) : [];

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="대화 기록" backHref="/dialogue" />

        <section className="space-y-5 px-1">
          {/* §Hero */}
          <article
            className="rounded-[18px] border p-5"
            style={{
              background: 'var(--app-pink-soft)',
              borderColor: 'var(--app-pink-line)',
            }}
          >
            <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
              내 대화
            </div>
            <h1
              className="mt-1.5 text-[22px] font-extrabold leading-snug tracking-tight text-[var(--app-ink)]"
              style={{ wordBreak: 'keep-all' }}
            >
              지금까지 나눈 대화
              <br />
              {sessions.length}개
            </h1>
            <p
              className="mt-2 text-[12.5px] leading-[1.6] text-[var(--app-copy-muted)]"
              style={{ wordBreak: 'keep-all' }}
            >
              12지신 선생님과 나눈 질문·답변을 시기 순으로 다시 살펴볼 수 있습니다.
            </p>
          </article>

          {/* §Sessions */}
          {!user ? (
            <article
              className="rounded-[18px] border bg-white p-5 text-center"
              style={{ borderColor: 'var(--app-pink-line)' }}
            >
              <div className="text-[32px]">💬</div>
              <h2 className="mt-2 text-[16px] font-extrabold text-[var(--app-ink)]" style={{ wordBreak: 'keep-all' }}>
                로그인하면 대화 기록을 볼 수 있어요
              </h2>
              <p className="mt-2 text-[12px] leading-[1.6] text-[var(--app-copy-muted)]" style={{ wordBreak: 'keep-all' }}>
                대화 내용은 본인 계정에만 안전하게 저장됩니다.
              </p>
              <Link
                href="/login?next=%2Fdialogue%2Fhistory"
                className="mt-4 inline-flex items-center justify-center rounded-full bg-[var(--app-pink)] px-5 py-3 text-[13px] font-extrabold text-white"
              >
                로그인 →
              </Link>
            </article>
          ) : sessions.length === 0 ? (
            <article
              className="rounded-[18px] border bg-white p-5 text-center"
              style={{ borderColor: 'var(--app-line)' }}
            >
              <div className="text-[32px]">🌱</div>
              <h2 className="mt-2 text-[16px] font-extrabold text-[var(--app-ink)]" style={{ wordBreak: 'keep-all' }}>
                아직 나눈 대화가 없어요
              </h2>
              <p className="mt-2 text-[12px] leading-[1.6] text-[var(--app-copy-muted)]" style={{ wordBreak: 'keep-all' }}>
                대화방에서 첫 질문을 던져보세요. 대화 내용이 여기 자동으로 저장됩니다.
              </p>
              <Link
                href="/dialogue"
                className="mt-4 inline-flex items-center justify-center rounded-full bg-[var(--app-pink)] px-5 py-3 text-[13px] font-extrabold text-white"
              >
                대화 시작하기 →
              </Link>
            </article>
          ) : (
            <section>
              <h2 className="px-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-muted)]">
                최근 대화 — {sessions.length}건
              </h2>
              <div className="mt-2 grid gap-2.5">
                {sessions.map((session) => {
                  const expertId = normalizeDialogueExpertId(session.expertId) ?? 'dragon';
                  const meta = getDialogueExpertMeta(expertId);
                  return (
                    <Link
                      key={session.sessionId}
                      href={`/dialogue/history/${session.sessionId}`}
                      className="flex items-start gap-3 rounded-[16px] border bg-white p-4 transition-transform active:scale-[0.98]"
                      style={{ borderColor: 'var(--app-line)' }}
                    >
                      <ZodiacChip kind={expertId as ZodiacKey} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[13px] font-extrabold text-[var(--app-ink)]">
                            {meta.teacherName}
                          </span>
                          <span className="shrink-0 text-[10.5px] font-bold text-[var(--app-copy-soft)]">
                            {formatRelativeTime(session.lastAt)}
                          </span>
                        </div>
                        <p
                          className="mt-1 text-[12.5px] font-bold text-[var(--app-copy)]"
                          style={{
                            wordBreak: 'keep-all',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          Q. {session.firstQuestion}
                        </p>
                        {session.lastReply ? (
                          <p
                            className="mt-1 text-[11.5px] leading-[1.55] text-[var(--app-copy-soft)]"
                            style={{
                              wordBreak: 'keep-all',
                              display: '-webkit-box',
                              WebkitLineClamp: 1,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            A. {session.lastReply}
                          </p>
                        ) : null}
                        <div className="mt-1.5 text-[10.5px] font-bold text-[var(--app-pink-strong)]">
                          메시지 {session.messageCount}개 · 자세히 보기 →
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </section>
      </AppPage>
    </AppShell>
  );
}
