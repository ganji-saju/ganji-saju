'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { GangiPageHeader, GangiSection } from '@/components/gangi/gangi-ui';
import { FollowUpQuestionChips } from '@/components/today-fortune/follow-up-question-chips';
import { OpportunityRiskCards } from '@/components/today-fortune/opportunity-risk-cards';
import { PremiumLockCard } from '@/components/today-fortune/premium-lock-card';
import { SajuReasonSnippet } from '@/components/today-fortune/saju-reason-snippet';
import { TodayScoreReveal } from '@/components/today-fortune/today-score-reveal';
import { TodayFortuneScoreGrid } from '@/components/today-fortune/today-fortune-score-grid';
import { TodayFortuneSummaryCard } from '@/components/today-fortune/today-fortune-summary-card';
import { trackMoonlightEvent } from '@/lib/analytics';
import { normalizeConcernId } from '@/lib/today-fortune/concerns';
import type { ConcernId, TodayFortuneFreeResult } from '@/lib/today-fortune/types';

const TODAY_RESULT_STORAGE_PREFIX = 'moonlight:today-fortune:result:';

const RELATED_LINKS: Record<ConcernId, Array<{ label: string; href: string; body: string }>> = {
  love_contact: [
    { label: '궁합으로 이어보기', href: '/compatibility', body: '상대와의 거리와 속도를 더 넓게 봅니다.' },
    { label: '대화로 더 묻기', href: '/dialogue', body: '오늘 어떤 말투가 편한지 바로 물어볼 수 있어요.' },
  ],
  money_spend: [
    { label: '사주로 더 보기', href: '/saju/new', body: '돈이 새는 습관과 선택 패턴을 이어서 봅니다.' },
    { label: '대화로 더 묻기', href: '/dialogue', body: '오늘 결제해도 되는지 짧게 물어볼 수 있어요.' },
  ],
  work_meeting: [
    { label: '사주로 더 보기', href: '/saju/new', body: '일과 역할의 큰 흐름을 이어서 봅니다.' },
    { label: '대화로 더 묻기', href: '/dialogue', body: '미팅에서 꺼낼 말과 줄일 말을 물어볼 수 있어요.' },
  ],
  relationship_conflict: [
    { label: '궁합으로 이어보기', href: '/compatibility', body: '상대와 부딪히는 지점을 같이 봅니다.' },
    { label: '대화로 더 묻기', href: '/dialogue', body: '오해를 줄이는 한마디를 바로 물어볼 수 있어요.' },
  ],
  energy_health: [
    { label: '사주로 더 보기', href: '/saju/new', body: '생활 리듬과 회복 패턴을 이어서 봅니다.' },
    { label: '대화로 더 묻기', href: '/dialogue', body: '오늘 무리하지 않는 기준을 물어볼 수 있어요.' },
  ],
  general: [
    { label: '타로로 보완하기', href: '/tarot/daily', body: '지금 마음의 결을 카드 한 장으로 가볍게 봅니다.' },
    { label: '사주로 더 보기', href: '/saju/new', body: '오늘을 넘어서 내 기본 흐름까지 이어서 봅니다.' },
  ],
};

function readStoredResult(sourceSessionId: string | undefined) {
  if (!sourceSessionId) return null;

  try {
    const raw = window.sessionStorage.getItem(`${TODAY_RESULT_STORAGE_PREFIX}${sourceSessionId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TodayFortuneFreeResult;
    return parsed.sourceSessionId === sourceSessionId ? parsed : null;
  } catch {
    return null;
  }
}

function buildTodayDetailHref(result: TodayFortuneFreeResult) {
  const params = new URLSearchParams({
    sourceSessionId: result.sourceSessionId,
    concern: result.concernId,
  });

  return `/today-fortune/detail?${params.toString()}`;
}

export function TodayFortuneResultClient({
  sourceSessionId,
  concern,
}: {
  sourceSessionId?: string;
  concern?: string;
}) {
  const [freeResult, setFreeResult] = useState<TodayFortuneFreeResult | null>(null);
  const concernId = normalizeConcernId(concern);
  const relatedLinks = useMemo(() => RELATED_LINKS[freeResult?.concernId ?? concernId], [concernId, freeResult]);

  useEffect(() => {
    const stored = readStoredResult(sourceSessionId);
    if (!stored) return;

    setFreeResult(stored);
    trackMoonlightEvent('premium_teaser_viewed', {
      from: 'today-fortune-result',
      concern: stored.concernId,
      sourceSessionId: stored.sourceSessionId,
    });
  }, [sourceSessionId]);

  function handleUnlock() {
    if (!freeResult) return;
    window.location.href = buildTodayDetailHref(freeResult);
  }

  return (
    <div className="gangi-subpage pb-8">
      <GangiPageHeader title="오늘의 운세" backHref="/today-fortune" />

      {/* Redesign 2026-05-13: mockup screens-a.jsx ScreenToday 의 4 핵심 섹션을 상단에 배치하고,
          기존 추가 무료 콘텐츠(기회/주의 / 사주 단서 / 후속 질문 / 관련 링크)는 하단 details 로 접어 보존. */}
      <div className="grid gap-4 px-4 py-5">
        {!freeResult ? (
          <section className="rounded-[1.8rem] border border-[var(--app-line)] bg-white p-6 text-center shadow-[0_14px_42px_rgba(0,0,0,0.06)]">
            <div className="app-caption">결과를 다시 불러와 주세요</div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-[var(--app-ink)]">
              무료 결과가 이 브라우저에 남아 있지 않아요
            </h1>
            <p className="mt-3 text-sm leading-7 text-[var(--app-copy)]">
              개인정보가 담긴 결과라 공개 URL로 다시 불러오지 않습니다. 오늘운세에서 한 번 더 눌러주세요.
            </p>
            <Link href={`/today-fortune?concern=${concernId}`} className="mt-5 inline-flex">
              <span className="rounded-full bg-[var(--app-pink)] px-5 py-3 text-sm font-bold text-white">
                오늘운세 다시 보기
              </span>
            </Link>
          </section>
        ) : (
          <>
            {/* mockup §1 — date eyebrow + 총운 헤드라인 */}
            <TodayFortuneSummaryCard result={freeResult} />

            {/* mockup §2 — 핑크 banner 큰 점수 */}
            <TodayScoreReveal result={freeResult} />

            {/* mockup §3 — 4-card 점수 grid */}
            <TodayFortuneScoreGrid result={freeResult} />

            {/* mockup §4 — 550원 자세히 보기 unlock */}
            <PremiumLockCard
              copy={freeResult.nextAction.copy}
              coinCost={freeResult.nextAction.coinCost}
              onUnlock={handleUnlock}
              loading={false}
              sourceSessionId={freeResult.sourceSessionId}
              concernId={freeResult.concernId}
            />

            {/* 하단 — 추가 무료 콘텐츠 (기존 가치 보존, 접힘 상태가 기본) */}
            <details className="group rounded-[20px] border border-[var(--app-line)] bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 text-[14px] font-bold text-[var(--app-ink)] [&::-webkit-details-marker]:hidden">
                <span>더 깊이 들여다보기</span>
                <span
                  aria-hidden="true"
                  className="text-[var(--app-copy-muted)] transition-transform group-open:rotate-180"
                >
                  ▾
                </span>
              </summary>
              <div className="grid gap-4 border-t border-[var(--app-line)] px-4 py-5">
                <OpportunityRiskCards result={freeResult} />
                <SajuReasonSnippet result={freeResult} />

                <section className="app-panel p-5">
                  <FollowUpQuestionChips
                    questions={freeResult.followUpQuestions}
                    sourceSessionId={freeResult.sourceSessionId}
                    concernId={freeResult.concernId}
                  />
                </section>

                <GangiSection
                  eyebrow="더 보고 싶을 때"
                  title="궁금한 부분만 이어보세요"
                  description="오늘운세는 빠른 체크입니다. 더 보고 싶을 때만 사주, 타로, 대화로 이어가면 됩니다."
                >
                  <div className="grid gap-3">
                    {relatedLinks.map((item) => (
                      <Link key={item.label} href={item.href} className="gangi-list-link">
                        <span className="gangi-list-copy">
                          <strong>{item.label}</strong>
                          <em>{item.body}</em>
                        </span>
                        <ArrowRight className="h-5 w-5 text-[rgba(17,17,20,0.44)]" />
                      </Link>
                    ))}
                  </div>
                </GangiSection>
              </div>
            </details>
          </>
        )}
      </div>
    </div>
  );
}
