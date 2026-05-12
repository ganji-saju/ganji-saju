'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { FlowEntryList } from '@/components/moonlight/FlowEntryList';
import { LightSection } from '@/components/moonlight/LightSection';
import { PageIntro } from '@/components/moonlight/PageIntro';
import { SafetyNotice } from '@/components/moonlight/SafetyNotice';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
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
    { label: '성향궁합으로 이어보기', href: '/compatibility/personality', body: '상대와의 거리감과 말의 템포를 관계의 결로 봅니다.' },
    { label: '12간지 캐릭터에게 묻기', href: '/dialogue', body: '오늘 연락의 온도와 타이밍을 가볍게 이어 물어보세요.' },
  ],
  money_spend: [
    { label: '성향사주로 이어보기', href: '/saju/personality', body: '돈을 다루는 습관과 선택 패턴을 사주×성향으로 봅니다.' },
    { label: '12간지 캐릭터에게 묻기', href: '/dialogue', body: '오늘 돈이 새는 행동을 한 번 더 좁혀 물어보세요.' },
  ],
  work_meeting: [
    { label: '성향사주로 이어보기', href: '/saju/personality', body: '일에서 힘이 나는 방식과 지치는 지점을 함께 봅니다.' },
    { label: '12간지 캐릭터에게 묻기', href: '/dialogue', body: '미팅에서 줄일 말과 살릴 말을 바로 이어서 물어보세요.' },
  ],
  relationship_conflict: [
    { label: '성향궁합으로 이어보기', href: '/compatibility/personality', body: '두 사람의 사주와 성향이 어디서 부딪히는지 봅니다.' },
    { label: '12간지 캐릭터에게 묻기', href: '/dialogue', body: '오해를 줄이는 말의 결을 바로 이어서 물어보세요.' },
  ],
  energy_health: [
    { label: '성향사주로 이어보기', href: '/saju/personality', body: '생활 리듬과 회복 패턴을 자기이해 관점으로 봅니다.' },
    { label: '12간지 캐릭터에게 묻기', href: '/dialogue', body: '오늘 무리하지 않는 기준을 더 구체적으로 물어보세요.' },
  ],
  general: [
    { label: '타로로 보완하기', href: '/tarot/daily', body: '지금 마음의 결을 한 장의 카드로 가볍게 더 확인합니다.' },
    { label: '성향사주로 이어보기', href: '/saju/personality', body: '오늘 흐름을 넘어서 내 선택 습관까지 이어봅니다.' },
    { label: '12간지 캐릭터에게 묻기', href: '/dialogue', body: '풀이가 남으면 대화방에서 바로 이어 물어보세요.' },
  ],
};


interface TodayFortuneApiResponse {
  ok?: boolean;
  result?: TodayFortuneFreeResult;
  error?: string;
}

const TODAY_RESULT_STORAGE_PREFIX = 'moonlight:today-fortune:result:';

export function TodayFortuneExperience({
  initialConcernId,
}: {
  initialConcernId?: string;
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

  function handleUnlock() {
    if (!freeResult) return;

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

  return (
    <div className="gangi-subpage pb-8">
      <GangiPageHeader title="오늘운세" />
      <PageIntro
        eyebrow="오늘의 결"
        title="오늘의 흐름을 가볍게 확인하세요"
        description="한 가지 고민을 먼저 고르면 오늘 필요한 한 줄과 다음 행동을 짧게 정리해드려요."
        actions={
          <Link href="/saju/personality" className="gangi-secondary-button">
            더 깊게 보려면 성향사주로 이어보기
          </Link>
        }
        className="px-4 sm:px-0"
      />

      <section className="px-4">
        <TodayConcernSelector
          value={concernId}
          onChange={(next) => {
            setConcernId(next);
            setDraft((current) => ({ ...current, concernId: next }));
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

            <LightSection
              eyebrow="다음 흐름"
              title="무료 결과가 마음에 남으면 여기서만 이어보세요"
              description="오늘운세는 빠른 체크입니다. 더 깊게 보려면 성향사주, 성향궁합, 12간지 대화로 이어가면 됩니다."
              surface="soft"
            >
              <FlowEntryList
                items={relatedLinks.map((item) => ({
                  id: item.href + item.label,
                  href: item.href,
                  title: item.label,
                  description: item.body,
                  meta: '이어보기',
                }))}
              />
            </LightSection>
            <SafetyNotice />
          </>
        ) : null}
      </div>
    </div>
  );
}
