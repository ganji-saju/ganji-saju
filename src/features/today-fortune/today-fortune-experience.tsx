'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { GangiIntro, GangiPageHeader, GangiSection } from '@/components/gangi/gangi-ui';
import { BirthInfoStepper } from '@/components/today-fortune/birth-info-stepper';
import { FollowUpQuestionChips } from '@/components/today-fortune/follow-up-question-chips';
import { HitMemoWidget } from '@/components/today-fortune/hit-memo-widget';
import { OpportunityRiskCards } from '@/components/today-fortune/opportunity-risk-cards';
import { PremiumLockCard } from '@/components/today-fortune/premium-lock-card';
import { SajuReasonSnippet } from '@/components/today-fortune/saju-reason-snippet';
import { TodayConcernSelector } from '@/components/today-fortune/today-concern-selector';
import { TodayScoreReveal } from '@/components/today-fortune/today-score-reveal';
import { TodayFortuneScoreGrid } from '@/components/today-fortune/today-fortune-score-grid';
import { TodayFortuneSummaryCard } from '@/components/today-fortune/today-fortune-summary-card';
import { TodayPremiumPanel } from '@/components/today-fortune/today-premium-panel';
import { usePreferredCounselor } from '@/features/counselor/use-preferred-counselor';
import { trackMoonlightEvent } from '@/lib/analytics';
import type { FortuneFeedbackAccuracyLabel } from '@/lib/fortune-feedback';
import { normalizeConcernId } from '@/lib/today-fortune/concerns';
import {
  getPendingHitMemoSession,
  markHitMemoResponded,
  rememberHitMemoSession,
  type StoredHitMemoSession,
} from '@/lib/today-fortune/hit-memo';
import type {
  ConcernId,
  TodayFortuneBirthPayload,
  TodayFortuneFreeResult,
  TodayFortunePremiumResult,
} from '@/lib/today-fortune/types';

const INITIAL_DRAFT: TodayFortuneBirthPayload = {
  concernId: 'general',
  calendarType: 'solar',
  timeRule: 'standard',
  year: '',
  month: '',
  day: '',
  hour: '',
  minute: '',
  unknownBirthTime: false,
  gender: '',
  birthLocationCode: '',
  birthLocationLabel: '',
  birthLatitude: '',
  birthLongitude: '',
};

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
    { label: '상세 사주 보기', href: '/saju/new', body: '직업 방향과 역할의 기준을 더 분명하게 정리합니다.' },
    { label: '대화로 더 묻기', href: '/dialogue', body: '미팅에서 피할 말과 강조할 말을 바로 이어서 물을 수 있습니다.' },
  ],
  relationship_conflict: [
    { label: '궁합으로 이어보기', href: '/compatibility', body: '관계의 온도와 갈등 포인트를 두 사람 기준으로 읽습니다.' },
    { label: '대화로 더 묻기', href: '/dialogue', body: '오해를 줄이는 말의 결을 바로 이어서 물을 수 있습니다.' },
  ],
  energy_health: [
    { label: '상세 사주 보기', href: '/saju/new', body: '생활 리듬과 회복 패턴을 원국 기준으로 더 깊게 읽습니다.' },
    { label: '대화로 더 묻기', href: '/dialogue', body: '무리하면 바로 티 나는 구간을 더 구체적으로 물을 수 있습니다.' },
  ],
  general: [
    { label: '타로로 보완하기', href: '/tarot/daily', body: '지금 마음의 결을 한 장의 카드로 가볍게 더 확인합니다.' },
    { label: '상세 사주 보기', href: '/saju/new', body: '오늘 흐름을 넘어서 내 명식의 큰 바탕까지 이어집니다.' },
  ],
};


interface TodayFortuneApiResponse {
  ok?: boolean;
  result?: TodayFortuneFreeResult;
  error?: string;
}

interface TodayFortuneUnlockResponse {
  ok?: boolean;
  freeResult?: TodayFortuneFreeResult;
  result?: TodayFortunePremiumResult;
  error?: string;
  remaining?: number;
  access?: 'charged' | 'reused' | 'purchased';
}

const TODAY_RESULT_STORAGE_PREFIX = 'moonlight:today-fortune:result:';

export function TodayFortuneExperience({
  initialConcernId,
  paidProduct,
  paidSourceSessionId,
}: {
  initialConcernId?: string;
  paidProduct?: string;
  paidSourceSessionId?: string;
}) {
  const router = useRouter();
  const { counselorId } = usePreferredCounselor();
  const [expanded, setExpanded] = useState(false);
  const [concernId, setConcernId] = useState<ConcernId>(normalizeConcernId(initialConcernId));
  const [draft, setDraft] = useState<TodayFortuneBirthPayload>({
    ...INITIAL_DRAFT,
    concernId: normalizeConcernId(initialConcernId),
  });
  const [hasTrackedBirthStart, setHasTrackedBirthStart] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [freeResult, setFreeResult] = useState<TodayFortuneFreeResult | null>(null);
  const [premiumResult, setPremiumResult] = useState<TodayFortunePremiumResult | null>(null);
  const [remainingCredits, setRemainingCredits] = useState<number | null>(null);
  const [pendingHitMemo, setPendingHitMemo] = useState<StoredHitMemoSession | null>(null);
  const [purchasedNotice, setPurchasedNotice] = useState<string | null>(null);

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

  useEffect(() => {
    if (paidProduct !== 'today-detail' || !paidSourceSessionId) return;

    let cancelled = false;

    async function openPurchasedTodayDetail() {
      setUnlocking(true);
      setUnlockError(null);

      try {
        const response = await fetch('/api/today-fortune/unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceSessionId: paidSourceSessionId,
            concernId,
            counselorId,
          }),
        });
        const data = (await response.json().catch(() => null)) as TodayFortuneUnlockResponse | null;

        if (cancelled) return;

        if (!response.ok || !data?.ok || !data.result) {
          setUnlockError(data?.error ?? '구매한 오늘 자세히 보기를 여는 중 오류가 있었습니다.');
          return;
        }

        if (data.freeResult) setFreeResult(data.freeResult);
        setPremiumResult(data.result);
        setRemainingCredits(data.remaining ?? null);
        if (data.access === 'purchased') {
          setPurchasedNotice('이미 구매한 오늘 자세히 보기를 다시 열었습니다. 코인은 차감하지 않았습니다.');
        }
      } catch {
        if (!cancelled) setUnlockError('구매한 오늘 자세히 보기를 여는 중 네트워크 오류가 있었습니다.');
      } finally {
        if (!cancelled) setUnlocking(false);
      }
    }

    void openPurchasedTodayDetail();

    return () => {
      cancelled = true;
    };
  }, [concernId, counselorId, paidProduct, paidSourceSessionId]);

  function updateDraft(patch: Partial<TodayFortuneBirthPayload>) {
    setDraft((current) => ({ ...current, ...patch, concernId }));
  }

  function handleStarted() {
    if (hasTrackedBirthStart) return;
    trackMoonlightEvent('birth_form_started', {
      from: 'today-fortune',
      concern: concernId,
    });
    setHasTrackedBirthStart(true);
  }

  async function handleSubmit() {
    setLoading(true);
    setErrorMessage(null);
    setUnlockError(null);
    setPremiumResult(null);

    try {
      const response = await fetch('/api/today-fortune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          concernId,
          counselorId,
        }),
      });
      const data = (await response.json().catch(() => null)) as TodayFortuneApiResponse | null;

      if (!response.ok || !data?.ok || !data.result) {
        setErrorMessage(data?.error ?? '무료 결과를 만드는 중 오류가 있었습니다.');
        return;
      }

      setFreeResult(data.result);
      try {
        window.localStorage.setItem('moonlight:fortune-session:last', data.result.sourceSessionId);
        window.sessionStorage.setItem(
          `${TODAY_RESULT_STORAGE_PREFIX}${data.result.sourceSessionId}`,
          JSON.stringify(data.result)
        );
      } catch {
        // Private browsing can block storage; navigation still continues.
      }
      trackMoonlightEvent('birth_form_completed', {
        from: 'today-fortune',
        concern: concernId,
      });
      trackMoonlightEvent('today_free_result_viewed', {
        from: 'today-fortune',
        concern: data.result.concernId,
        sourceSessionId: data.result.sourceSessionId,
      });
      router.push(
        `/today-fortune/result?sourceSessionId=${encodeURIComponent(data.result.sourceSessionId)}&concern=${encodeURIComponent(data.result.concernId)}`
      );
    } catch {
      setErrorMessage('무료 결과를 만드는 중 네트워크 오류가 있었습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function handleUnlock() {
    if (!freeResult) return;

    setUnlocking(true);
    setUnlockError(null);

    try {
      const response = await fetch('/api/today-fortune/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceSessionId: freeResult.sourceSessionId,
          concernId: freeResult.concernId,
          counselorId,
        }),
      });
      const data = (await response.json().catch(() => null)) as TodayFortuneUnlockResponse | null;

      if (response.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent(`/today-fortune?concern=${freeResult.concernId}`)}`;
        return;
      }

      if (!response.ok || !data?.ok || !data.result) {
        setUnlockError(data?.error ?? '오늘 자세히 보기를 여는 중 오류가 있었습니다.');
        setRemainingCredits(data?.remaining ?? null);
        return;
      }

      if (data.freeResult) setFreeResult(data.freeResult);
      setPremiumResult(data.result);
      setRemainingCredits(data.remaining ?? null);
      if (data.access === 'purchased') {
        setPurchasedNotice('이미 구매한 오늘 자세히 보기를 다시 열었습니다. 코인은 차감하지 않았습니다.');
      }
      trackMoonlightEvent('premium_result_viewed', {
        from: 'today-fortune',
        concern: freeResult.concernId,
        sourceSessionId: freeResult.sourceSessionId,
      });
    } catch {
      setUnlockError('오늘 자세히 보기를 여는 중 네트워크 오류가 있었습니다.');
    } finally {
      setUnlocking(false);
    }
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

  return (
    <div className="gangi-subpage pb-8">
      <GangiPageHeader title="오늘운세" />
      <GangiIntro
        title={
          <>
            오늘 어떤 부분이
            <br />
            가장 궁금해요?
          </>
        }
        description="한 가지를 골라야 더 또렷이 보여드려요."
      />

      <section className="px-4">
        <TodayConcernSelector
          value={concernId}
          onChange={(next) => {
            setConcernId(next);
            setDraft((current) => ({ ...current, concernId: next }));
            setFreeResult(null);
            setPremiumResult(null);
            setUnlockError(null);
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

        <BirthInfoStepper
          draft={draft}
          onChange={updateDraft}
          onStarted={handleStarted}
          onSubmit={handleSubmit}
          loading={loading}
          errorMessage={errorMessage}
        />

        {freeResult ? (
          <>
            {purchasedNotice ? (
              <div className="rounded-[1.2rem] border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-700">
                {purchasedNotice}
              </div>
            ) : null}
            <TodayScoreReveal result={freeResult} />
            <TodayFortuneSummaryCard result={freeResult} />
            <TodayFortuneScoreGrid result={freeResult} />
            <OpportunityRiskCards result={freeResult} />
            <SajuReasonSnippet result={freeResult} />

            {premiumResult ? (
              <TodayPremiumPanel result={premiumResult} />
            ) : (
              <PremiumLockCard
                copy={freeResult.nextAction.copy}
                coinCost={freeResult.nextAction.coinCost}
                onUnlock={handleUnlock}
                loading={unlocking}
                sourceSessionId={freeResult.sourceSessionId}
                concernId={freeResult.concernId}
                errorMessage={
                  unlockError ||
                  (remainingCredits !== null ? `현재 잔여 코인 ${remainingCredits}개` : null)
                }
              />
            )}

            <section className="app-panel p-6">
              <FollowUpQuestionChips
                questions={(premiumResult ?? freeResult).followUpQuestions}
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
