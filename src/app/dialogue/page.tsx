// Redesign 2026-05-13 (Claude Design / screens-b.jsx ScreenDialogue):
// 대화방 진입 — 12지신 전문가 선택 list. PR6+ 디자인 언어 적용.
// 라우팅·이벤트 무수정.
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SafetyNotice } from '@/components/common/safety-notice';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { ZodiacChip, type ZodiacKey } from '@/components/gangi/zodiac-chip';
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
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="대화방" />

        <section className="space-y-5 px-1">
          {/* §1 Hero */}
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
              12간지 전문 분야
            </div>
            <h1 className="mt-1.5 text-[24px] font-extrabold leading-snug tracking-tight text-[var(--app-ink)]">
              어떤 선생님과
              <br />
              이야기 나눠볼까요?
            </h1>
            <p className="mt-2 text-[13px] leading-[1.6] text-[var(--app-copy-muted)]">
              분야를 고르고 바로 물어보세요. 각 선생님이 자신의 결로 답해드립니다.
            </p>
          </div>

          {/* §2 12지 전문가 list */}
          <div className="grid gap-2.5">
            {DIALOGUE_EXPERTS.map((expert) => {
              const active = selectedExpertId === expert.id;
              return (
                <Link
                  key={expert.id}
                  href={`/dialogue/${expert.id}`}
                  className="flex items-center gap-3 rounded-[14px] border bg-white p-3.5 transition"
                  style={{
                    borderColor: active ? 'var(--app-pink-line)' : 'var(--app-line)',
                    background: active ? 'var(--app-pink-soft)' : '#fff',
                  }}
                  data-active={active}
                >
                  <ZodiacChip kind={expert.id as ZodiacKey} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-extrabold tracking-tight text-[var(--app-ink)]">
                      {expert.teacherName}
                    </div>
                    <div className="mt-0.5 text-[12px] leading-[1.5] text-[var(--app-copy-muted)]">
                      <span className="font-bold text-[var(--app-pink-strong)]">
                        {expert.label}
                      </span>{' '}
                      · {expert.description}
                    </div>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-3 py-1 text-[11px] font-extrabold"
                    style={
                      active
                        ? {
                            background: 'var(--app-pink)',
                            color: '#fff',
                          }
                        : {
                            border: '1px solid var(--app-line)',
                            color: 'var(--app-copy-muted)',
                          }
                    }
                  >
                    {active ? '선택됨' : '선택'}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* §3 1:1 상담 예약 진입점 (mockup screens-f.jsx ScreenAppointment) */}
          <Link
            href="/dialogue/appointment"
            className="flex items-center gap-3 rounded-[18px] p-5 text-white"
            style={{
              background: 'var(--app-ink)',
              boxShadow: '0 18px 44px rgba(15,23,42,0.18)',
            }}
          >
            <div
              className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] text-[20px] font-extrabold"
              style={{
                background: 'var(--app-pink)',
                color: '#fff',
              }}
              aria-hidden="true"
            >
              📅
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="text-[11px] font-extrabold uppercase tracking-[0.04em]"
                style={{ color: 'var(--app-pink)' }}
              >
                1:1 예약
              </div>
              <div className="mt-1 text-[15px] font-extrabold leading-snug tracking-tight">
                선생님과 30분 깊은 상담 →
              </div>
              <div
                className="mt-0.5 text-[11.5px]"
                style={{ opacity: 0.65 }}
              >
                날짜와 시간을 골라 1:1 예약을 잡으세요
              </div>
            </div>
          </Link>

          {/* §4 안전 안내 */}
          <SafetyNotice variant="crisis" />
        </section>
      </AppPage>
    </AppShell>
  );
}
