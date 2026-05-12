'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { LightSection } from '@/components/moonlight/LightSection';
import { PageIntro } from '@/components/moonlight/PageIntro';
import { SafetyNotice } from '@/components/moonlight/SafetyNotice';
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
    <div className="gangi-subpage pb-8">
      <GangiPageHeader title="오늘 자세히 보기" backHref={resultHref} />
      <PageIntro
        eyebrow="오늘의 결 깊이보기"
        title="오늘 남은 질문을 조금 더 좁혀봅니다"
        description="무료 결과에서 이어지는 상세 풀이입니다. 결제·코인 권한 확인 뒤 열람 가능한 내용만 보여드립니다."
        className="px-4 pt-3 sm:px-0"
      />

      <div className="grid gap-5 px-4 py-6">
        {!sourceSessionId ? (
          <section className="rounded-[1.8rem] border border-[var(--app-line)] bg-white p-6 text-center shadow-[0_14px_42px_rgba(0,0,0,0.06)]">
            <div className="app-caption">결과가 필요해요</div>
            <h1 className="mt-3 text-2xl font-semibold leading-9 text-[var(--app-ink)]">
              먼저 오늘운세 무료 결과를 만들어 주세요
            </h1>
            <p className="mt-3 text-sm leading-7 text-[var(--app-copy)]">
              오늘 자세히 보기는 방금 만든 결과에 연결해서 열립니다.
            </p>
            <Link href={`/today-fortune?concern=${encodeURIComponent(concernId)}`} className="mt-5 inline-flex rounded-full bg-[var(--app-pink)] px-6 py-3 text-sm font-semibold text-white">
              오늘운세 보러가기
            </Link>
          </section>
        ) : null}

        {loading ? (
          <section className="rounded-[1.8rem] border border-[var(--app-pink-line)] bg-[var(--app-pink-soft)] p-6 text-center">
            <div className="app-caption">열람 준비 중</div>
            <h1 className="mt-3 text-2xl font-semibold leading-9 text-[var(--app-ink)]">
              오늘 자세히 보기를 여는 중입니다
            </h1>
            <p className="mt-3 text-sm leading-7 text-[var(--app-copy)]">
              결제 또는 코인 사용 이력을 확인한 뒤 이 화면에서 보여드릴게요.
            </p>
          </section>
        ) : null}

        {error ? (
          <section className="rounded-[1.8rem] border border-[var(--app-line)] bg-white p-6 text-center shadow-[0_14px_42px_rgba(0,0,0,0.06)]">
            <div className="app-caption text-[var(--app-coral)]">열람 실패</div>
            <h1 className="mt-3 text-2xl font-semibold leading-9 text-[var(--app-ink)]">
              바로 열지 못했습니다
            </h1>
            <p className="mt-3 text-sm leading-7 text-[var(--app-copy)]">{error}</p>
            {remainingCredits !== null ? (
              <p className="mt-2 text-sm text-[var(--app-copy-soft)]">현재 잔여 코인 {remainingCredits}개</p>
            ) : null}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Link href={resultHref} className="rounded-full border border-[var(--app-line)] bg-white px-5 py-3 text-sm font-semibold text-[var(--app-ink)]">
                무료 결과로 돌아가기
              </Link>
              <Link href="/credits?from=today-detail" className="rounded-full bg-[var(--app-pink)] px-5 py-3 text-sm font-semibold text-white">
                코인 충전 보기
              </Link>
            </div>
          </section>
        ) : null}

        {notice && result ? (
          <div className="rounded-[1.2rem] border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-700">
            {notice}
          </div>
        ) : null}

        {result ? <TodayPremiumPanel result={result} /> : null}

        {result ? (
          <LightSection
            eyebrow="다음 흐름"
            title="풀이가 남으면 이어서 물어보세요"
            description="상세 결과를 바탕으로 12간지 캐릭터에게 오늘의 선택을 더 가볍게 물어볼 수 있습니다."
            surface="soft"
          >
            <div className="grid gap-2 sm:grid-cols-2">
            <Link href={resultHref} className="rounded-full border border-[var(--app-line)] bg-white px-5 py-3 text-center text-sm font-semibold text-[var(--app-ink)]">
              무료 결과로 돌아가기
            </Link>
            <Link href="/dialogue" className="rounded-full bg-[var(--app-ink)] px-5 py-3 text-center text-sm font-semibold text-white">
              12간지 캐릭터에게 이어 묻기
            </Link>
          </div>
          </LightSection>
        ) : null}
        <SafetyNotice />
      </div>
    </div>
  );
}
