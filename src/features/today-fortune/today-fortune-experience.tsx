'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { GangiLoadingOverlay, GangiPageHeader, GangiSection } from '@/components/gangi/gangi-ui';
import { FollowUpQuestionChips } from '@/components/today-fortune/follow-up-question-chips';
import { HitMemoWidget } from '@/components/today-fortune/hit-memo-widget';
import { OpportunityRiskCards } from '@/components/today-fortune/opportunity-risk-cards';
import { PremiumLockCard } from '@/components/today-fortune/premium-lock-card';
import { SajuReasonSnippet } from '@/components/today-fortune/saju-reason-snippet';
import { TodayConcernSelector } from '@/components/today-fortune/today-concern-selector';
import { TodayScoreReveal } from '@/components/today-fortune/today-score-reveal';
import { TodayFortuneScoreGrid } from '@/components/today-fortune/today-fortune-score-grid';
import { TodayFortuneSummaryCard } from '@/components/today-fortune/today-fortune-summary-card';
import { UnifiedIntake } from '@/features/unified-intake/unified-intake';
import { submitTodayFromProfile } from '@/features/unified-intake/submit-today';
import type { UnifiedBirthProfile } from '@/features/unified-intake/birth-profile-store';
import { trackMoonlightEvent } from '@/lib/analytics';
import type { FortuneFeedbackAccuracyLabel } from '@/lib/fortune-feedback';
import { normalizeConcernId } from '@/lib/today-fortune/concerns';
import {
  getPendingHitMemoSession,
  markHitMemoResponded,
  rememberHitMemoSession,
  type StoredHitMemoSession,
} from '@/lib/today-fortune/hit-memo';
import { markPendingUnlock } from '@/lib/today-fortune/unlock-marker';
import type { ConcernId, TodayFortuneFreeResult } from '@/lib/today-fortune/types';

const RELATED_LINKS: Record<ConcernId, Array<{ label: string; href: string; body: string }>> = {
  love_contact: [
    { label: '궁합으로 이어보기', href: '/compatibility', body: '상대와의 거리감과 템포를 더 넓게 봅니다.' },
    { label: '대화로 더 묻기', href: '/dialogue', body: '왜 오늘 연락을 조심해야 하는지 바로 이어서 물을 수 있습니다.' },
  ],
  money_spend: [
    { label: '상세 사주 보기', href: '/saju/new', body: '재물 감각과 지출 패턴을 원국 중심으로 더 깊게 봅니다.' },
    { label: '대화로 더 묻기', href: '/dialogue', body: '오늘 돈이 새는 행동을 한 번 더 좁혀 물을 수 있습니다.' },
  ],
  work_meeting: [
    { label: '상세 사주 보기', href: '/saju/new', body: '직업 방향과 역할의 선을 더 분명하게 정리합니다.' },
    { label: '대화로 더 묻기', href: '/dialogue', body: '미팅에서 피할 말과 강조할 말을 바로 이어서 물을 수 있습니다.' },
  ],
  relationship_conflict: [
    { label: '궁합으로 이어보기', href: '/compatibility', body: '관계의 온도와 갈등 포인트를 두 사람 흐름으로 읽습니다.' },
    { label: '대화로 더 묻기', href: '/dialogue', body: '오해를 줄이는 말투를 바로 이어서 물을 수 있습니다.' },
  ],
  energy_health: [
    { label: '상세 사주 보기', href: '/saju/new', body: '생활 리듬과 회복 패턴을 원국 흐름으로 더 깊게 읽습니다.' },
    { label: '대화로 더 묻기', href: '/dialogue', body: '무리하면 바로 티 나는 구간을 더 구체적으로 물을 수 있습니다.' },
  ],
  general: [
    { label: '타로로 보완하기', href: '/tarot/daily', body: '지금 마음의 흐름을 세 장의 카드로 가볍게 더 확인합니다.' },
    { label: '상세 사주 보기', href: '/saju/new', body: '오늘 흐름을 넘어서 내 명식의 큰 바탕까지 이어집니다.' },
  ],
};


export function TodayFortuneExperience({
  initialConcernId,
}: {
  initialConcernId?: string;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [concernId, setConcernId] = useState<ConcernId>(normalizeConcernId(initialConcernId));
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [freeResult, setFreeResult] = useState<TodayFortuneFreeResult | null>(null);
  const [pendingHitMemo, setPendingHitMemo] = useState<StoredHitMemoSession | null>(null);

  const relatedLinks = useMemo(() => RELATED_LINKS[concernId], [concernId]);

  useEffect(() => {
    if (freeResult) {
      window.localStorage.setItem('moonlight:fortune-session:last', freeResult.sourceSessionId);
      rememberHitMemoSession({
        sourceSessionId: freeResult.sourceSessionId,
        concernId: freeResult.concernId,
        headline: freeResult.oneLine.headline,
        createdAt: new Date().toISOString(),
      });
      setPendingHitMemo(getPendingHitMemoSession());
      trackMoonlightEvent('premium_teaser_viewed', {
        from: 'today-fortune',
        concern: freeResult.concernId,
        sourceSessionId: freeResult.sourceSessionId,
      });
    }
  }, [freeResult]);

  useEffect(() => {
    setPendingHitMemo(getPendingHitMemoSession());
  }, []);

  // Task6 — BirthInfoStepper + handleSubmit(구 POST /api/today-fortune 바디+결과캐시+네비게이션)를
  // UnifiedIntake(intent="today") + submitTodayFromProfile 로 교체. 요청 계약(캐시 키·결과 href)은
  // submitTodayFromProfile(src/features/unified-intake/submit-today.ts) 이 동일하게 이식해 보존한다.
  // /saju/new (saju-new-client.tsx handleResolve) 와 동일한 submitting 가드 패턴: 성공 시 loading 을
  // 되돌리지 않고(페이지 전환 완료까지 overlay 유지), 실패 시에만 복귀.
  async function handleResolve(profile: UnifiedBirthProfile) {
    if (loading) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const href = await submitTodayFromProfile(profile, { concernId });
      router.push(href);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : '무료 결과를 만드는 중 오류가 있었습니다.'
      );
      setLoading(false);
    }
  }

  function handleUnlock() {
    if (!freeResult) return;

    // 2026-05-17 PR #201 — detail page 가 자동 POST 트리거할 수 있게 sessionStorage marker.
    //   detail page 의 consumePendingUnlock 이 marker 보고 POST (deduct). 없으면 GET (read-only).
    markPendingUnlock(freeResult.sourceSessionId);

    const params = new URLSearchParams({
      sourceSessionId: freeResult.sourceSessionId,
      concern: freeResult.concernId,
    });

    router.push(`/today-fortune/detail?${params.toString()}`);
  }

  async function handleHitMemoSubmit(accuracyLabel: FortuneFeedbackAccuracyLabel) {
    if (!pendingHitMemo) return;

    markHitMemoResponded(pendingHitMemo.sourceSessionId, accuracyLabel);
    setPendingHitMemo(null);

    trackMoonlightEvent('feedback_submitted', {
      from: 'today-fortune',
      concern: pendingHitMemo.concernId,
      sourceSessionId: pendingHitMemo.sourceSessionId,
      accuracyLabel,
    });
    trackMoonlightEvent(
      accuracyLabel === 'correct'
        ? 'hit_memo_response_correct'
        : accuracyLabel === 'partial'
          ? 'hit_memo_response_partial'
          : 'hit_memo_response_miss',
      {
        from: 'today-fortune',
        concern: pendingHitMemo.concernId,
        sourceSessionId: pendingHitMemo.sourceSessionId,
      }
    );

    await fetch('/api/today-fortune/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceSessionId: pendingHitMemo.sourceSessionId,
        concernId: pendingHitMemo.concernId,
        accuracyLabel,
      }),
    }).catch(() => null);
  }

  if (loading) {
    return (
      <div className="gangi-subpage pb-8">
        <GangiPageHeader title="오늘운세" />
        <GangiLoadingOverlay
          title="오늘 운세를 풀어드리고 있어요"
          description="네 기둥과 오늘 흐름을 맞춰보는 중입니다."
        />
      </div>
    );
  }

  return (
    <div className="gangi-subpage pb-8">
      <GangiPageHeader title="오늘운세" />

      {/* 2026-05-14: intro 는 TodayConcernSelector 가 pink-soft hero 로 자체 렌더. */}
      <section className="px-4 pt-1">
        <TodayConcernSelector
          value={concernId}
          onChange={(next) => {
            setConcernId(next);
            setFreeResult(null);
            trackMoonlightEvent('today_concern_selected', {
              from: 'today-fortune',
              concern: next,
            });
          }}
          expanded={expanded}
          onToggleExpanded={() => setExpanded((current) => !current)}
        />
      </section>

      <div className="mt-6 grid gap-6 px-4">
        {pendingHitMemo ? (
          <HitMemoWidget
            session={pendingHitMemo}
            onSubmit={handleHitMemoSubmit}
          />
        ) : null}

        <UnifiedIntake
          intent="today"
          submitting={loading}
          onResolve={handleResolve}
          // Task6b — 인입 퍼널 회귀 수정: 폼 최초 상호작용 시 birth_form_started 복원.
          onStarted={() => trackMoonlightEvent('birth_form_started', { from: 'today-fortune', concern: concernId })}
        />

        {errorMessage ? (
          <p role="alert" className="text-[14.4px] font-medium text-[var(--app-coral,#e11d48)]">
            {errorMessage}
          </p>
        ) : null}

        {freeResult ? (
          <>
            <TodayScoreReveal result={freeResult} />
            <TodayFortuneSummaryCard result={freeResult} />
            <TodayFortuneScoreGrid result={freeResult} />
            <OpportunityRiskCards result={freeResult} />
            <SajuReasonSnippet result={freeResult} />

            <PremiumLockCard
              copy={freeResult.nextAction.copy}
              coinCost={freeResult.nextAction.coinCost}
              onUnlock={handleUnlock}
              loading={false}
              sourceSessionId={freeResult.sourceSessionId}
              concernId={freeResult.concernId}
            />

            <section className="app-panel p-6">
              <FollowUpQuestionChips
                questions={freeResult.followUpQuestions}
                sourceSessionId={freeResult.sourceSessionId}
                concernId={freeResult.concernId}
              />
            </section>

            <GangiSection
              eyebrow="더 보고 싶을 때"
              title="무료 결과가 마음에 남으면 여기서만 이어보세요"
              description="오늘운세는 빠른 체크입니다. 더 보고 싶을 때만 사주, 타로, 대화로 자연스럽게 이어집니다."
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
          </>
        ) : null}
      </div>
    </div>
  );
}
