// Redesign 2026-05-14 (PR6+ 디자인 언어 통일):
// /today-fortune/detail — 1코인 결제 후 또는 재방문 시 진입.
// 기존: 가운데 정렬 평문 + 작은 그림자 카드 + 초록 notice.
// 변경: 외곽 wrapper 를 sub-page 통일된 wrapper 로, lock/loading/error/notice
//       모두 PR6+ pink-soft hero 패턴으로 통일. 하단 CTA 도 pink/ink 굵은 버튼.
'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, MessageCircleMore } from 'lucide-react';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { TodayPremiumPanel } from '@/components/today-fortune/today-premium-panel';
import { usePreferredCounselor } from '@/features/counselor/use-preferred-counselor';
import { trackMoonlightEvent } from '@/lib/analytics';
import { normalizeConcernId } from '@/lib/today-fortune/concerns';
import type {
  ConcernId,
  TodayFortuneFreeResult,
  TodayFortunePremiumResult,
} from '@/lib/today-fortune/types';

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
  const concernId: ConcernId = normalizeConcernId(concern);

  useEffect(() => {
    if (attemptedRef.current || !sourceSessionId) return;
    attemptedRef.current = true;
    const activeSourceSessionId = sourceSessionId;

    let cancelled = false;

    async function openDetail() {
      setLoading(true);
      setError(null);

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

  const resultHref = sourceSessionId
    ? `/today-fortune/result?sourceSessionId=${encodeURIComponent(sourceSessionId)}&concern=${encodeURIComponent(freeResult?.concernId ?? concernId)}`
    : `/today-fortune?concern=${encodeURIComponent(concernId)}`;

  return (
    <div className="gangi-subpage saju-result-page pb-8">
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

        {/* §로딩 — pink-soft + shimmer */}
        {loading ? (
          <article
            className="rounded-[18px] border p-6 text-center"
            style={{
              background: 'var(--app-pink-soft)',
              borderColor: 'var(--app-pink-line)',
            }}
          >
            <div
              className="mx-auto grid h-14 w-14 place-items-center rounded-full text-[22px] font-extrabold"
              style={{
                background: '#fff',
                color: 'var(--app-pink-strong)',
                border: '1px solid var(--app-pink-line)',
                fontFamily: 'var(--font-han)',
              }}
              aria-hidden="true"
            >
              月
            </div>
            <div className="mt-3 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
              열람 준비 중
            </div>
            <h1 className="mt-1 text-[18px] font-extrabold leading-[1.4] tracking-tight text-[var(--app-ink)]">
              오늘 자세히 보기를
              <br />
              여는 중입니다
            </h1>
            <p className="mt-2 text-[12.5px] leading-[1.65] text-[var(--app-copy-muted)]">
              결제 또는 코인 사용 이력을 확인한 뒤 보여드릴게요.
            </p>
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

        {result ? <TodayPremiumPanel result={result} /> : null}

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
