'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { GangiLoadingOverlay, GangiPageHeader, GangiSection } from '@/components/gangi/gangi-ui';
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
import { markPendingUnlock } from '@/lib/today-fortune/unlock-marker';
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

// PR #166 — prefix 버전업. PR #165 점수 통일 / PR #166 이름 주입 이전의 옛 캐시는 자동 무효화.
const TODAY_RESULT_STORAGE_PREFIX = 'moonlight:today-fortune:result:v3:';

// 2026-05-15: 일자별 캐시 분리 — 어제 결과가 오늘 화면에 그대로 보이지 않도록
// sourceSessionId 만 키로 쓰던 sessionStorage 에 dateKey 를 함께 붙인다.
function buildResultStorageKey(sourceSessionId: string, dateKey: string) {
  return `${TODAY_RESULT_STORAGE_PREFIX}${sourceSessionId}:${dateKey}`;
}

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
    // PR #162 — 12간지 모션 최소 노출 시간 가드 (intake 와 동일 패턴).
    // 결과 페이지의 loading.tsx 가 같은 모션을 이어받으므로 짧게.
    const MIN_LOADING_MS = 600;
    const loadingStartedAt = Date.now();
    let didNavigate = false;

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

      // PR #162 — setFreeResult 제거. 이전 코드는 router.push 직전에 freeResult 를
      // state 에 set 해서 현재 페이지에 inline 카드들이 잠깐 노출됐다 사라지는 어색한
      // 흐름이 있었음. 이제 sessionStorage 만 저장 → 결과 페이지가 읽어서 표시.
      try {
        window.localStorage.setItem('moonlight:fortune-session:last', data.result.sourceSessionId);
        window.sessionStorage.setItem(
          buildResultStorageKey(data.result.sourceSessionId, data.result.dateKey),
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

      const nextHref = `/today-fortune/result?sourceSessionId=${encodeURIComponent(data.result.sourceSessionId)}&concern=${encodeURIComponent(data.result.concernId)}`;
      router.prefetch(nextHref);

      // 모션 최소 노출 시간 보장.
      const elapsed = Date.now() - loadingStartedAt;
      if (elapsed < MIN_LOADING_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_LOADING_MS - elapsed));
      }
      router.push(nextHref);
      didNavigate = true;
    } catch {
      setErrorMessage('무료 결과를 만드는 중 네트워크 오류가 있었습니다.');
    } finally {
      // 페이지 전환 완료까지 overlay 유지 (intake 와 동일 패턴 — didNavigate 가드).
      if (!didNavigate) {
        setLoading(false);
      }
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

  return (
    <div className="gangi-subpage pb-8">
      {/* PR #162 — 무료 결과 생성 중 12간지 로딩 모션. 결과 페이지 loading.tsx 와
          동일 디자인이라 router.push 후에도 자연스럽게 이어짐. */}
      {loading ? (
        <GangiLoadingOverlay
          title="오늘 운세를 풀어드리고 있어요"
          description="네 기둥과 오늘 흐름을 맞춰보는 중입니다."
        />
      ) : null}
      <GangiPageHeader title="오늘운세" />

      {/* 2026-05-14: intro 는 TodayConcernSelector 가 pink-soft hero 로 자체 렌더. */}
      <section className="px-4 pt-1">
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
