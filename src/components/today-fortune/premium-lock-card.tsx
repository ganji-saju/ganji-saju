// Redesign 2026-05-13 (Claude Design / screens-a.jsx §4 ScreenToday — Detail unlock):
// snake ZodiacChip + 550원 작은풀이 eyebrow + 오늘 자세히 보기 h3 + 1줄 desc + 구매 pill.
// 기존 모든 CTA (코인 열기 / 550원 결제 / 코인 충전) 보존 — mockup 의 단일 "구매"는 코인 열기로 매핑.
'use client';

import { Lock } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ZodiacChip } from '@/components/gangi/zodiac-chip';
import { trackMoonlightEvent } from '@/lib/analytics';
// 2026-05-16 — today-detail 결제 중복 시도 차단을 위해 entitlement 확인 후
//   결제 button 또는 "이미 구매" UI 분기.
import { useProductEntitlement } from '@/lib/payments/use-product-entitlement';

interface PremiumLockCardProps {
  copy: string;
  coinCost: number;
  onUnlock: () => void;
  loading: boolean;
  sourceSessionId: string;
  concernId: string;
  errorMessage?: string | null;
}

export function PremiumLockCard({
  copy,
  coinCost,
  onUnlock,
  loading,
  sourceSessionId,
  concernId,
  errorMessage,
}: PremiumLockCardProps) {
  // 2026-05-16 — 이 사용자가 같은 sourceSessionId 의 today-detail 을 이미 결제/언락
  //   했다면 결제 button 대신 "이미 구매" UI 노출. 미인증/네트워크 실패 시는 기존 흐름.
  const { hasEntitlement, openHref } = useProductEntitlement({
    productId: 'today-detail',
    slug: sourceSessionId,
    scope: concernId,
    enabled: Boolean(sourceSessionId),
  });

  function handleUnlockClick() {
    trackMoonlightEvent('unlock_clicked', {
      from: 'today-fortune',
      concern: concernId,
      sourceSessionId,
      productCode: 'TODAY_DETAIL_VIEW',
    });
    onUnlock();
  }

  // 이미 구매한 today-detail 인 경우 — 결제 button 대신 열람 link.
  if (hasEntitlement && openHref) {
    return (
      <section
        className="relative overflow-hidden rounded-[20px] border bg-white p-4"
        style={{ borderColor: 'rgba(45,135,88,0.22)', boxShadow: '0 14px 36px rgba(45,135,88,0.08)' }}
      >
        <Link
          href={openHref}
          className="flex w-full items-center gap-3.5 text-left"
        >
          <ZodiacChip kind="snake" size="md" className="shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-extrabold tracking-[0.04em] text-[var(--app-jade)]">
              ✓ 이미 구매한 풀이
            </div>
            <div className="mt-0.5 text-[15px] font-extrabold tracking-tight text-[var(--app-ink)]">
              오늘 자세히 보기
            </div>
            <div className="mt-0.5 text-[11.5px] text-[var(--app-copy-soft)]">
              결제 없이 바로 열람합니다
            </div>
          </div>
          <span
            className="shrink-0 inline-flex items-center rounded-full bg-[var(--app-jade)] px-3 py-2 text-[12px] font-extrabold text-white"
          >
            바로 열기 →
          </span>
        </Link>
      </section>
    );
  }

  return (
    <section
      className="relative overflow-hidden rounded-[20px] border border-[var(--app-pink-line)] bg-white p-4"
      style={{ boxShadow: '0 14px 36px rgba(216,27,114,0.10)' }}
    >
      {/* mockup: snake ZodiacChip + 550원·작은 풀이 + 헤드라인 + 한 줄 desc + 구매 pill */}
      <button
        type="button"
        onClick={handleUnlockClick}
        disabled={loading}
        className="flex w-full items-center gap-3.5 text-left disabled:opacity-70"
      >
        <ZodiacChip kind="snake" size="md" className="shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-extrabold tracking-[0.04em] text-[var(--app-pink-strong)]">
            550원 · 작은 풀이
          </div>
          <div className="mt-0.5 text-[15px] font-extrabold tracking-tight text-[var(--app-ink)]">
            오늘 자세히 보기
          </div>
          <div className="mt-0.5 text-[11.5px] text-[var(--app-copy-soft)]">
            지금 흐름 · 조심할 시간대 · 핵심 한 줄
          </div>
        </div>
        <span
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-[var(--app-pink)] px-3 py-2 text-[12px] font-extrabold text-white"
          style={{ boxShadow: '0 8px 20px rgba(216,27,114,0.28)' }}
        >
          {/* 2026-05-15 handoff 60 m-spinners — inline ring spinner */}
          {loading ? <span className="motion-spinner-inline" aria-hidden="true" /> : null}
          {loading ? '여는 중' : `${coinCost}코인 열기`}
        </span>
      </button>

      {/* 결제·코인 부족 케이스용 보조 CTA — 라우팅 유지 */}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Link
          href={`/membership/checkout?product=today-detail&slug=${encodeURIComponent(sourceSessionId)}&scope=${encodeURIComponent(concernId)}&from=today-fortune`}
          className="min-w-0"
        >
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-11 w-full rounded-full border-[var(--app-pink-line)] bg-white text-[13px] font-bold text-[var(--app-pink-strong)] hover:bg-[var(--app-pink-soft)]"
          >
            550원 바로 결제
          </Button>
        </Link>
        <Link href="/credits?from=today-fortune" className="min-w-0">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-11 w-full rounded-full border-[rgba(17,17,20,0.12)] bg-[var(--app-ink)] text-[13px] font-bold text-white hover:bg-[rgba(17,17,20,0.86)] hover:text-white"
          >
            코인 충전 보기
          </Button>
        </Link>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-[var(--app-copy-muted)]">
        <Lock className="mr-1 inline h-3 w-3 align-[-1px]" />
        {copy}
      </p>

      {errorMessage ? (
        <p className="mt-3 text-[12px] text-[var(--app-coral)]">{errorMessage}</p>
      ) : null}
    </section>
  );
}
