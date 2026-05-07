'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CounselorSelector } from '@/components/counselor/counselor-selector';
import type { FocusTopic } from '@/domain/saju/report';
import { usePreferredCounselor } from '@/features/counselor/use-preferred-counselor';
import type { MoonlightCounselorId } from '@/lib/counselors';
import { simplifySajuCopy } from '@/lib/saju/public-copy';
import type { SajuAiInterpretation } from '@/server/ai/saju-interpretation';
import { cn } from '@/lib/utils';
import { AiSourceBadge } from './ai-source-badge';

type AiSource = 'openai' | 'fallback';
type FallbackReason = 'ai_not_configured' | 'empty_ai_response' | 'quota_exceeded' | 'openai_error';

interface InterpretResponse {
  ok?: boolean;
  source?: AiSource;
  model?: string | null;
  cached?: boolean;
  cacheable?: boolean;
  fallbackReason?: FallbackReason | null;
  errorMessage?: string | null;
  counselorId?: MoonlightCounselorId | null;
  interpretation?: SajuAiInterpretation;
  error?: string;
}

interface InterpretationState {
  source: AiSource;
  model: string | null;
  cached: boolean;
  fallbackReason: FallbackReason | null;
  errorMessage: string | null;
  counselorId: MoonlightCounselorId;
  interpretation: SajuAiInterpretation;
  fromApi: boolean;
}

type ComparisonState = Partial<Record<MoonlightCounselorId, InterpretationState>>;

interface SajuAiInterpretationPanelProps {
  readingId: string;
  topic: FocusTopic;
  focusLabel: string;
  fallbackInterpretation: SajuAiInterpretation;
  cacheEnabled: boolean;
}

const INSIGHT_FULL_WIDTH_THRESHOLD = 96;

function getCompactTextLength(value: string) {
  return value.replace(/\s+/g, '').length;
}

function shouldInsightUseFullRow(insight: string) {
  return getCompactTextLength(insight) >= INSIGHT_FULL_WIDTH_THRESHOLD;
}

function getFallbackReasonLabel(reason: FallbackReason | null, fromApi: boolean) {
  if (!fromApi) return '기본 리포트 문장을 먼저 표시 중입니다.';

  switch (reason) {
    case 'ai_not_configured':
      return '정밀 해석 연결 전이라 기본 해석으로 표시 중입니다.';
    case 'empty_ai_response':
      return '정밀 해석 내용이 비어 있어 기본 해석으로 표시 중입니다.';
    case 'quota_exceeded':
      return 'OpenAI 사용량 또는 결제 한도가 초과되어 기본 해석으로 표시 중입니다.';
    case 'openai_error':
      return '정밀 해석을 불러오지 못해 기본 해석으로 안전하게 전환했습니다.';
    default:
      return '기본 해석으로 표시 중입니다.';
  }
}

function createFallbackState(
  counselorId: MoonlightCounselorId,
  interpretation: SajuAiInterpretation
): InterpretationState {
  return {
    source: 'fallback',
    model: null,
    cached: false,
    fallbackReason: null,
    errorMessage: null,
    counselorId,
    interpretation,
    fromApi: false,
  };
}

export function SajuAiInterpretationPanel({
  readingId,
  topic,
  focusLabel,
  fallbackInterpretation,
  cacheEnabled,
}: SajuAiInterpretationPanelProps) {
  const autoLoadedRef = useRef(false);
  const { counselorId, hydrated: counselorReady, selectCounselor } = usePreferredCounselor();
  const [status, setStatus] = useState<'ready' | 'loading' | 'answered' | 'error'>(
    cacheEnabled ? 'loading' : 'ready'
  );
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InterpretationState>({
    ...createFallbackState(counselorId, fallbackInterpretation),
  });
  const [comparison, setComparison] = useState<ComparisonState>({
    female: createFallbackState('female', fallbackInterpretation),
    male: createFallbackState('male', fallbackInterpretation),
  });

  const loadInterpretation = useCallback(async (requestedCounselorId?: MoonlightCounselorId) => {
    const activeCounselorId = requestedCounselorId ?? counselorId;
    setStatus('loading');
    setError(null);

    try {
      const counselorTargets = Array.from(
        new Set<MoonlightCounselorId>([activeCounselorId, 'female', 'male'])
      );

      const responses = await Promise.allSettled(
        counselorTargets.map(async (targetCounselorId) => {
          const response = await fetch('/api/interpret', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              readingId,
              topic,
              counselorId: targetCounselorId,
            }),
          });
          const payload = (await response.json()) as InterpretResponse;

          if (!response.ok || !payload.ok || !payload.interpretation) {
            throw new Error(
              payload.error ??
                `${targetCounselorId === 'male' ? '남선생' : '여선생'} 해석을 불러오지 못했습니다.`
            );
          }

          return {
            targetCounselorId,
            state: {
              source: payload.source ?? 'fallback',
              model: payload.model ?? null,
              cached: payload.cached === true,
              fallbackReason: payload.fallbackReason ?? null,
              errorMessage: payload.errorMessage ?? null,
              counselorId: payload.counselorId ?? targetCounselorId,
              interpretation: payload.interpretation,
              fromApi: true,
            } satisfies InterpretationState,
          };
        })
      );

      const nextComparison: ComparisonState = {
        female: createFallbackState('female', fallbackInterpretation),
        male: createFallbackState('male', fallbackInterpretation),
      };
      let activeResult: InterpretationState | null = null;

      for (const item of responses) {
        if (item.status !== 'fulfilled') {
          continue;
        }

        nextComparison[item.value.targetCounselorId] = item.value.state;
        if (item.value.targetCounselorId === activeCounselorId) {
          activeResult = item.value.state;
        }
      }

      setComparison(nextComparison);
      setResult(
        activeResult ?? createFallbackState(activeCounselorId, fallbackInterpretation)
      );
      setStatus('answered');
    } catch (requestError) {
      setStatus('error');
      setError(
        requestError instanceof Error
          ? requestError.message
          : '잠시 후 다시 시도해 주세요.'
      );
    }
  }, [counselorId, fallbackInterpretation, readingId, topic]);

  useEffect(() => {
    autoLoadedRef.current = false;
    setResult(createFallbackState(counselorId, fallbackInterpretation));
    setComparison({
      female: createFallbackState('female', fallbackInterpretation),
      male: createFallbackState('male', fallbackInterpretation),
    });
    setStatus(cacheEnabled ? 'loading' : 'ready');
    setError(null);
  }, [cacheEnabled, counselorId, fallbackInterpretation, readingId, topic]);

  useEffect(() => {
    if (!cacheEnabled || autoLoadedRef.current || !counselorReady) return;

    autoLoadedRef.current = true;
    void loadInterpretation();
  }, [cacheEnabled, counselorReady, loadInterpretation]);

  const badgeState =
    status === 'loading'
      ? 'loading'
      : status === 'error'
        ? 'error'
        : result.source === 'openai'
          ? 'openai'
          : 'fallback';
  const interpretation =
    status === 'loading' && !result.fromApi ? fallbackInterpretation : result.interpretation;
  const comparisonOrder: MoonlightCounselorId[] =
    counselorId === 'male' ? ['male', 'female'] : ['female', 'male'];

  return (
    <section className="rounded-[1.75rem] border border-[var(--app-pink-line)] bg-[linear-gradient(180deg,#ffffff,#fff7fb)] p-5 shadow-[0_18px_48px_rgba(216,27,114,0.08)] sm:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="app-caption text-[var(--app-pink-strong)]">선생님 풀이 · {focusLabel}</div>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-[var(--app-ink)]">
            {simplifySajuCopy(interpretation.headline)}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--app-copy)]">
            {status === 'loading'
              ? '입력된 사주 정보를 바탕으로 읽기 쉬운 풀이를 정리하는 중입니다.'
              : simplifySajuCopy(interpretation.summary)}
          </p>
          <div className="mt-4 max-w-4xl">
            <CounselorSelector
              value={counselorId}
              onChange={(nextCounselor) => {
                void selectCounselor(nextCounselor);
                void loadInterpretation(nextCounselor);
              }}
              variant="compact"
              title="말투 선택"
              description="같은 내용을 더 부드럽게 들을지, 더 또렷하게 들을지만 고르면 됩니다."
            />
          </div>
        </div>
        <AiSourceBadge state={badgeState} />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {interpretation.insights.map((insight, index) => (
          <div
            key={`${index}-${insight}`}
            className={cn(
              'rounded-[1.25rem] border border-[var(--app-line)] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(216,27,114,0.05)]',
              shouldInsightUseFullRow(insight) ? 'md:col-span-2' : undefined
            )}
          >
            <div className="text-[11px] font-bold text-[var(--app-pink-strong)]">
              포인트 {index + 1}
            </div>
            <p className="mt-3 text-sm leading-7 text-[var(--app-copy)]">{simplifySajuCopy(insight)}</p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <div className="app-caption text-[var(--app-pink-strong)]">말투 바꿔 보기</div>
        <p className="mt-2 text-sm leading-7 text-[var(--app-copy-soft)]">
          풀이 내용은 유지하고, 설명하는 온도만 다르게 정리합니다.
        </p>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {comparisonOrder.map((compareCounselorId) => {
            const compareState =
              comparison[compareCounselorId] ??
              createFallbackState(compareCounselorId, fallbackInterpretation);
            const isActive = compareState.counselorId === result.counselorId;

            return (
              <article
                key={compareCounselorId}
                className={cn(
                  'rounded-[1.3rem] border bg-white px-5 py-5',
                  isActive
                    ? 'border-[var(--app-pink-line)] shadow-[0_18px_48px_rgba(216,27,114,0.1)]'
                    : 'border-[var(--app-line)]'
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-[var(--app-ivory)]">
                      {compareCounselorId === 'male' ? '또렷한 말투' : '부드러운 말투'}
                    </div>
                    <div className="mt-1 text-xs text-[var(--app-copy-soft)]">
                      {isActive ? '현재 선택됨' : '비교용'}
                    </div>
                  </div>
                  <span
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-[11px]',
                      compareState.source === 'openai'
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-[var(--app-line)] bg-[var(--app-surface-muted)] text-[var(--app-copy-soft)]'
                    )}
                  >
                    {compareState.source === 'openai' ? '정밀 해석' : '기본 해석'}
                  </span>
                </div>
                <div className="mt-4 text-lg font-semibold leading-8 text-[var(--app-ivory)]">
                  {simplifySajuCopy(compareState.interpretation.headline)}
                </div>
                <p className="mt-3 text-sm leading-7 text-[var(--app-copy)]">
                  {simplifySajuCopy(compareState.interpretation.summary)}
                </p>
                <div className="mt-4 grid gap-2">
                  {compareState.interpretation.insights.slice(0, 2).map((insight, index) => (
                    <div
                      key={`${compareCounselorId}-${index}-${insight}`}
                      className="rounded-[1rem] border border-[var(--app-line)] bg-[var(--app-pink-soft)] px-3 py-3 text-sm leading-7 text-[var(--app-copy)]"
                    >
                      {simplifySajuCopy(insight)}
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs leading-6 text-[var(--app-copy-soft)]">
        <span>{result.counselorId === 'male' ? '달빛 남선생 풀이' : '달빛 여선생 풀이'}</span>
        {result.source === 'openai' ? (
          <span>{result.cached ? '저장된 해석' : '새로 정리'}</span>
        ) : (
          <span>{getFallbackReasonLabel(result.fallbackReason, result.fromApi)}</span>
        )}
        {result.errorMessage ? <span>오류: {result.errorMessage}</span> : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void loadInterpretation()}
          disabled={status === 'loading'}
          className="gangi-primary-button"
        >
          {status === 'loading' ? '불러오는 중' : cacheEnabled ? '저장된 해석 확인' : '해석 정리하기'}
        </button>
        {!cacheEnabled ? (
          <span className="text-xs leading-6 text-[var(--app-copy-soft)]">
            임시 결과는 이 화면에서 한 번만 정리합니다.
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="mt-4 rounded-[1.1rem] border border-[var(--app-coral)]/30 bg-[var(--app-coral)]/10 px-4 py-3 text-sm leading-7 text-[var(--app-ivory)]">
          {error}
        </div>
      ) : null}
    </section>
  );
}
