// Redesign 2026-05-14 (PR6+ 디자인 언어 통일):
// /today-fortune/detail — 1코인 결제 후 또는 재방문 시 진입.
// 기존: 가운데 정렬 평문 + 작은 그림자 카드 + 초록 notice.
// 변경: 외곽 wrapper 를 sub-page 통일된 wrapper 로, lock/loading/error/notice
//       모두 PR6+ pink-soft hero 패턴으로 통일. 하단 CTA 도 pink/ink 굵은 버튼.
'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, MessageCircleMore } from 'lucide-react';
import { GangiLoadingOverlay, GangiPageHeader } from '@/components/gangi/gangi-ui';
import { TodayPremiumPanel } from '@/components/today-fortune/today-premium-panel';
import { usePreferredCounselor } from '@/features/counselor/use-preferred-counselor';
import { trackMoonlightEvent } from '@/lib/analytics';
import { normalizeConcernId } from '@/lib/today-fortune/concerns';
import type {
  ConcernId,
  TodayFortuneFreeResult,
  TodayFortunePremiumResult,
} from '@/lib/today-fortune/types';
// 2026-05-15 fix — 결제 후 페이지가 무료보다 빈약했던 회귀 fix.
// 무료 페이지의 모든 카드 (#103~#106) + 확장된 프리미엄 콘텐츠를 모두 노출.
import { TodayFortuneSummaryCard } from '@/components/today-fortune/today-fortune-summary-card';
import { TodayScoreReveal } from '@/components/today-fortune/today-score-reveal';
import { TodayIljinBreakdownCard } from '@/components/today-fortune/today-iljin-breakdown-card';
import { TodayCategoryReadings } from '@/components/today-fortune/today-category-readings';
import { TodayLuckyPackageCard } from '@/components/today-fortune/today-lucky-package-card';
import { TodaySajuChartCard } from '@/components/today-fortune/today-saju-chart-card';
import { TodayDaewoonCtaCard } from '@/components/today-fortune/today-daewoon-cta-card';
import { MotionResultReveal } from '@/components/motion/motion-primitives';
import '@/components/motion/motion-primitives.css';

interface TodayFortuneUnlockResponse {
  ok?: boolean;
  freeResult?: TodayFortuneFreeResult;
  result?: TodayFortunePremiumResult;
  error?: string;
  remaining?: number;
  access?: 'charged' | 'reused' | 'purchased';
}

function getAccessNotice(access: TodayFortuneUnlockResponse['access']) {
  switch (access) {
    case 'charged':
      return '1코인으로 오늘 자세히 보기를 열었습니다.';
    case 'reused':
      return '이미 열어본 풀이입니다. 코인은 다시 차감하지 않았습니다.';
    case 'purchased':
      return '구매한 오늘 자세히 보기를 열었습니다.';
    default:
      return null;
  }
}

export function TodayFortuneDetailClient({
  sourceSessionId,
  concern,
  paidProduct,
}: {
  sourceSessionId?: string;
  concern?: string;
  paidProduct?: string;
}) {
  const { counselorId } = usePreferredCounselor();
  const [loading, setLoading] = useState(Boolean(sourceSessionId));
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TodayFortunePremiumResult | null>(null);
  const [freeResult, setFreeResult] = useState<TodayFortuneFreeResult | null>(null);
  const [remainingCredits, setRemainingCredits] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const attemptedRef = useRef(false);
  // 2026-05-16 fix — unlock 후 페이지 상단으로 튀는 회귀.
  // 사용자가 "1코인 열기" 누르면 detail 페이지로 이동 → 항상 최상단부터 렌더 →
  // 실제 결제한 컨텐츠(프리미엄 패널)는 화면 밖에 있음.
  // 해결: 로드 완료 후 premiumRef 위치로 부드럽게 스크롤.
  const premiumRef = useRef<HTMLDivElement | null>(null);
  const concernId: ConcernId = normalizeConcernId(concern);

  useEffect(() => {
    if (attemptedRef.current || !sourceSessionId) return;
    attemptedRef.current = true;
    const activeSourceSessionId = sourceSessionId;

    let cancelled = false;

    async function openDetail() {
      setLoading(true);
      setError(null);
      // PR #164 — 12간지 로딩 모션 최소 노출 시간 가드.
      // unlock 이 너무 빨라도 모션이 한 번은 보이게.
      const MIN_LOADING_MS = 600;
      const loadingStartedAt = Date.now();

      try {
        const response = await fetch('/api/today-fortune/unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceSessionId: activeSourceSessionId,
            concernId,
            counselorId,
          }),
        });
        const data = (await response.json().catch(() => null)) as TodayFortuneUnlockResponse | null;

        if (cancelled) return;
        // 최소 노출 시간 보장 — fetch 가 빨라도 모션 한 번 보임.
        const elapsed = Date.now() - loadingStartedAt;
        if (elapsed < MIN_LOADING_MS) {
          await new Promise((resolve) => setTimeout(resolve, MIN_LOADING_MS - elapsed));
        }
        if (cancelled) return;

        if (response.status === 401) {
          const next = `/today-fortune/detail?sourceSessionId=${encodeURIComponent(activeSourceSessionId)}&concern=${encodeURIComponent(concernId)}${paidProduct ? `&paid=${encodeURIComponent(paidProduct)}` : ''}`;
          window.location.href = `/login?next=${encodeURIComponent(next)}`;
          return;
        }

        if (!response.ok || !data?.ok || !data.result) {
          setError(data?.error ?? '오늘 자세히 보기를 여는 중 오류가 있었습니다.');
          setRemainingCredits(data?.remaining ?? null);
          return;
        }

        setResult(data.result);
        setFreeResult(data.freeResult ?? null);
        setRemainingCredits(data.remaining ?? null);
        setNotice(getAccessNotice(data.access));
        trackMoonlightEvent('premium_result_viewed', {
          from: 'today-fortune-detail',
          concern: data.freeResult?.concernId ?? concernId,
          sourceSessionId: activeSourceSessionId,
          access: data.access,
        });
      } catch {
        if (!cancelled) setError('오늘 자세히 보기를 여는 중 네트워크 오류가 있었습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void openDetail();

    return () => {
      cancelled = true;
    };
  }, [concernId, counselorId, paidProduct, sourceSessionId]);

  // 2026-05-16 — 로드 완료 + DOM 안정화 후 프리미엄 패널 위치로 스크롤.
  // unlock 직후 사용자가 "방금 산 컨텐츠" 를 바로 볼 수 있도록 보장.
  useEffect(() => {
    if (loading || !result) return;
    // stagger 모션이 끝나기 전에 스크롤하면 헛스크롤 — 다음 두 프레임 + 한 박자.
    const timeout = window.setTimeout(() => {
      premiumRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 220);
    return () => window.clearTimeout(timeout);
  }, [loading, result]);

  const resultHref = sourceSessionId
    ? `/today-fortune/result?sourceSessionId=${encodeURIComponent(sourceSessionId)}&concern=${encodeURIComponent(freeResult?.concernId ?? concernId)}`
    : `/today-fortune?concern=${encodeURIComponent(concernId)}`;

  return (
    <div className="gangi-subpage saju-result-page pb-8">
      {/* §전체 로딩 — 다른 페이지와 동일한 GangiLoadingOverlay 사용.
          unlock API 응답 → setResult 가 완료될 때까지 풀스크린 유지. */}
      {loading ? (
        <GangiLoadingOverlay
          title="오늘 자세히 보기를 여는 중"
          description="결제·코인 사용 이력을 확인하고 풀이를 정리하는 중입니다."
        />
      ) : null}

      <GangiPageHeader title="오늘 자세히 보기" backHref={resultHref} />

      <div className="space-y-4 px-1 py-4">
        {/* §결과 없음 — 무료 결과 만들러 안내 */}
        {!sourceSessionId ? (
          <article
            className="rounded-[18px] border p-6 text-center"
            style={{
              background: 'var(--app-pink-soft)',
              borderColor: 'var(--app-pink-line)',
            }}
          >
            <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
              결과가 필요해요
            </div>
            <h1
              className="mt-2 text-[20px] font-extrabold leading-[1.4] tracking-tight text-[var(--app-ink)]"
              style={{ wordBreak: 'keep-all' }}
            >
              먼저 오늘운세 무료 결과를
              <br />
              만들어 주세요
            </h1>
            <p className="mt-2.5 text-[13px] leading-[1.65] text-[var(--app-copy-muted)]">
              오늘 자세히 보기는 방금 만든 결과에 연결해서 열립니다.
            </p>
            <Link
              href={`/today-fortune?concern=${encodeURIComponent(concernId)}`}
              className="mt-5 inline-flex h-12 items-center justify-center rounded-full bg-[var(--app-pink)] px-5 text-[13.5px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)]"
            >
              오늘운세 보러가기 →
            </Link>
          </article>
        ) : null}

        {/* §에러 — coral 강조 */}
        {error ? (
          <article
            className="rounded-[18px] border p-5"
            style={{
              background: '#fdecec',
              borderColor: 'rgba(198,69,69,0.22)',
            }}
          >
            <div
              className="text-[11px] font-extrabold uppercase tracking-[0.04em]"
              style={{ color: 'var(--app-coral)' }}
            >
              열람 실패
            </div>
            <h1 className="mt-1.5 text-[18px] font-extrabold leading-[1.4] tracking-tight text-[var(--app-ink)]">
              바로 열지 못했습니다
            </h1>
            <p className="mt-2 text-[13px] leading-[1.65] text-[var(--app-copy)]">
              {error}
            </p>
            {remainingCredits !== null ? (
              <p className="mt-1.5 text-[12.5px] text-[var(--app-copy-soft)]">
                현재 잔여 코인 {remainingCredits}개
              </p>
            ) : null}
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Link
                href={resultHref}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-[var(--app-line)] bg-white text-[13px] font-extrabold text-[var(--app-copy-muted)]"
              >
                <ArrowLeft className="h-4 w-4" />
                무료 결과로
              </Link>
              <Link
                href="/credits?from=today-detail"
                className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--app-pink)] text-[13px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)]"
              >
                코인 충전 →
              </Link>
            </div>
          </article>
        ) : null}

        {/* §Notice — jade-tone 으로 통일 */}
        {notice && result ? (
          <div
            className="rounded-[12px] border px-3.5 py-2.5 text-[12.5px] leading-[1.6]"
            style={{
              background: '#e8f5ee',
              borderColor: 'rgba(45,135,88,0.18)',
              color: '#1f6a44',
            }}
          >
            ✓ {notice}
          </div>
        ) : null}

        {result ? (
          <>
            {/* 2026-05-15 fix — 무료 페이지의 모든 카드를 그대로 노출 (결제 후 빈약 회귀 fix).
                stagger 모션 안에서 자연스럽게 등장. */}
            {freeResult ? (
              <MotionResultReveal staggerSeconds={0.06}>
                {/* §1 — Summary */}
                <TodayFortuneSummaryCard result={freeResult} />
                {/* §2 — 큰 점수 + 7등급 + 등급 이모지 */}
                <TodayScoreReveal result={freeResult} />
                {/* §2.5 — 8영역 점수 산출 내역 + 발동 케이스 */}
                {freeResult.iljinScore ? (
                  <TodayIljinBreakdownCard
                    iljinScore={freeResult.iljinScore}
                    iljinMessages={freeResult.iljinMessages ?? null}
                  />
                ) : null}
                {/* §3 — 카테고리별 블루 헤드라인 stacked */}
                {/* 2026-05-16 — §4 한눈에 보기 2x3 grid 는 §3 와 같은 영역 점수를
                    중복 노출해 사용자 혼란 유발. 제거. */}
                <TodayCategoryReadings result={freeResult} />
                {/* §4.5 — 행운 패키지 12종 + 로또 6개 오행색 원 */}
                {freeResult.luckyPackage ? (
                  <TodayLuckyPackageCard luckyPackage={freeResult.luckyPackage} />
                ) : null}
                {/* §5 — 사주 명식 (4기둥 + 오행 + 신살 chip) */}
                {freeResult.sajuChart ? (
                  <TodaySajuChartCard chart={freeResult.sajuChart} />
                ) : null}
              </MotionResultReveal>
            ) : null}

            {/* §6 — 결제 전용 프리미엄 패널 (시간대 windows / 시나리오 / 행동)
                2026-05-16 — unlock 직후 자동 스크롤 anchor.
                  Q1/Q2/Q3 클릭으로 대화방 prefill 흐름 위해 sourceSessionId/concernId 전달. */}
            <div ref={premiumRef} className="scroll-mt-4">
              <TodayPremiumPanel
                result={result}
                sourceSessionId={freeResult?.sourceSessionId ?? sourceSessionId}
                concernId={freeResult?.concernId ?? concernId}
              />
            </div>

            {/* §7 — 대운 CTA */}
            {freeResult ? (
              <TodayDaewoonCtaCard sajuSlug={freeResult.sajuSlug ?? null} />
            ) : null}
          </>
        ) : null}

        {/* §하단 CTA */}
        {result ? (
          <div className="grid gap-2 pt-2 sm:grid-cols-2">
            <Link
              href={resultHref}
              className="inline-flex h-12 items-center justify-center gap-1.5 rounded-full border border-[var(--app-line)] bg-white text-[13px] font-extrabold text-[var(--app-copy-muted)]"
            >
              <ArrowLeft className="h-4 w-4" />
              무료 결과로 돌아가기
            </Link>
            <Link
              href="/dialogue"
              className="inline-flex h-12 items-center justify-center gap-1.5 rounded-full px-5 text-[13.5px] font-extrabold text-white"
              style={{
                background: 'var(--app-ink)',
                boxShadow: '0 12px 28px rgba(15,23,42,0.22)',
              }}
            >
              <MessageCircleMore className="h-4 w-4" />
              이어서 묻기
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
