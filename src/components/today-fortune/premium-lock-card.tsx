// Redesign 2026-05-13 (Claude Design / screens-a.jsx §4 ScreenToday — Detail unlock):
// snake ZodiacChip + 9,900원 자세한풀이 eyebrow + 오늘 자세히 보기 h3 + 1줄 desc + 구매 pill.
// 2026-06-30 — membership-first paywall:
//   branch 1: hasEntitlement → "이미 구매" UI (unchanged)
//   branch 2: memberFreeEligible → "멤버십에 포함 · 바로 열기" (no payment)
//   branch 3: else → membership CTA primary + card single + bundle + coin(legacy only)
//   /credits 링크 전면 제거 (전 판매 중단)
'use client';

import { Lock } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ZodiacChip } from '@/components/gangi/zodiac-chip';
import { trackMoonlightEvent } from '@/lib/analytics';
import { useProductEntitlement } from '@/lib/payments/use-product-entitlement';
import { ComparePrice, usePriceLabel } from '@/components/payments/price-provider';

interface PremiumLockCardProps {
  copy: string;
  coinCost: number;
  onUnlock: () => void;
  loading: boolean;
  sourceSessionId: string;
  concernId: string;
  errorMessage?: string | null;
  // 묶음(오늘 풀세트) 결제 링크. 사주 결과(sajuSlug)가 있을 때만 전달 →
  // {singleLabel} 단품 옆에 묶음 비교 CTA 노출. 없으면 기존 단품 레이아웃 유지.
  bundleHref?: string | null;
}

export function PremiumLockCard({
  copy,
  coinCost,
  onUnlock,
  loading,
  sourceSessionId,
  concernId,
  errorMessage,
  bundleHref,
}: PremiumLockCardProps) {
  const { hasEntitlement, openHref, memberFreeEligible, hasLegacyCoins, loading: entitlementLoading } = useProductEntitlement({
    productId: 'today-detail',
    slug: sourceSessionId,
    scope: concernId,
    enabled: Boolean(sourceSessionId),
  });

  // 2026-07-07 Phase 2 — 단품(오늘 자세히=saju_entry)·묶음(오늘 풀세트) 가격을 리졸버로 단일화.
  const singleLabel = usePriceLabel('saju_entry');
  const bundleLabel = usePriceLabel('bundle_today_set');

  function handleUnlockClick() {
    trackMoonlightEvent('unlock_clicked', {
      from: 'today-fortune',
      concern: concernId,
      sourceSessionId,
      productCode: 'TODAY_DETAIL_VIEW',
    });
    onUnlock();
  }

  // Loading guard: sourceSessionId 가 있고 entitlement fetch 가 아직 완료 전이면
  // 결제 CTA 를 노출하지 않는다. 멤버십 회원이 잠깐 '{singleLabel} 단품'을 보고 실수 결제하는
  // 것을 방지한다. sourceSessionId 가 없으면(enabled=false) 훅이 fetch 를 건너뛰므로
  // 이 guard 에 걸리지 않고 그대로 Branch 3 으로 진행한다.
  if (Boolean(sourceSessionId) && entitlementLoading && !hasEntitlement && !memberFreeEligible) {
    return (
      <section
        className="relative overflow-hidden rounded-[20px] border bg-white p-4"
        style={{ borderColor: 'rgba(17,17,20,0.12)', boxShadow: '0 14px 36px rgba(17,17,20,0.04)' }}
      >
        <div className="flex items-center gap-3.5">
          <ZodiacChip kind="snake" size="md" className="shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="mt-0.5 text-[17.3px] font-extrabold tracking-tight text-[var(--app-ink)]">
              오늘 자세히 보기
            </div>
            <div className="mt-0.5 text-[15px] text-[var(--app-copy-soft)]">
              <Lock className="mr-1 inline h-3 w-3 align-[-1px]" />
              {copy}
            </div>
          </div>
        </div>
        <button
          type="button"
          disabled
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-[16px] bg-[rgba(17,17,20,0.06)] text-[15.5px] font-extrabold text-[var(--app-copy-muted)] disabled:cursor-not-allowed"
        >
          <span className="motion-spinner-inline" aria-hidden="true" />
          확인하고 있어요
        </button>
      </section>
    );
  }

  // Branch 1: 이미 구매한 today-detail — 결제 button 대신 열람 link.
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
            <div className="text-[15px] font-extrabold tracking-[0.04em] text-[var(--app-jade)]">
              ✓ 이미 구매한 풀이
            </div>
            <div className="mt-0.5 text-[17.3px] font-extrabold tracking-tight text-[var(--app-ink)]">
              오늘 자세히 보기
            </div>
            <div className="mt-0.5 text-[15px] text-[var(--app-copy-soft)]">
              결제 없이 바로 열람합니다
            </div>
          </div>
          <span
            className="shrink-0 inline-flex items-center rounded-full bg-[var(--app-jade)] px-3 py-2 text-[13.8px] font-extrabold text-white"
          >
            바로 열기 →
          </span>
        </Link>
      </section>
    );
  }

  // Branch 2: 멤버십 회원 — 무료 열기 (결제 CTA 없음).
  if (memberFreeEligible) {
    return (
      <section
        className="relative overflow-hidden rounded-[20px] border bg-white p-4"
        style={{ borderColor: 'rgba(45,135,88,0.22)', boxShadow: '0 14px 36px rgba(45,135,88,0.08)' }}
      >
        <button
          type="button"
          onClick={handleUnlockClick}
          disabled={loading}
          className="flex w-full items-center gap-3.5 text-left disabled:opacity-70"
        >
          <ZodiacChip kind="snake" size="md" className="shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-extrabold tracking-[0.04em] text-[var(--app-jade)]">
              멤버십에 포함
            </div>
            <div className="mt-0.5 text-[17.3px] font-extrabold tracking-tight text-[var(--app-ink)]">
              오늘 자세히 보기
            </div>
            <div className="mt-0.5 text-[15px] text-[var(--app-copy-soft)]">
              지금 흐름 · 조심할 시간대 · 핵심 한 줄
            </div>
          </div>
          <span
            className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-[var(--app-jade)] px-3 py-2 text-[13.8px] font-extrabold text-white"
          >
            {loading ? <span className="motion-spinner-inline" aria-hidden="true" /> : null}
            {loading ? '여는 중' : '바로 열기 →'}
          </span>
        </button>
      </section>
    );
  }

  // Branch 3: 비멤버 / 레거시 전 보유자 — 멤버십 우선 결제 UI.
  const singleHref = `/membership/checkout?product=today-detail&slug=${encodeURIComponent(sourceSessionId)}&scope=${encodeURIComponent(concernId)}&from=today-fortune`;

  return (
    <section
      className="relative overflow-hidden rounded-[20px] border border-[var(--app-pink-line)] bg-white p-4"
      style={{ boxShadow: '0 14px 36px rgba(216,27,114,0.10)' }}
    >
      {/* 헤더: snake chip + 헤드라인 + 설명 */}
      <div className="flex items-center gap-3.5">
        <ZodiacChip kind="snake" size="md" className="shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-extrabold tracking-[0.04em] text-[var(--app-pink-strong)]">
            {singleLabel} · 자세한 풀이
          </div>
          <div className="mt-0.5 text-[17.3px] font-extrabold tracking-tight text-[var(--app-ink)]">
            오늘 자세히 보기
          </div>
          <div className="mt-0.5 text-[15px] text-[var(--app-copy-soft)]">
            지금 흐름 · 조심할 시간대 · 핵심 한 줄
          </div>
        </div>
      </div>

      {/* Primary CTA: 멤버십 */}
      <Link href="/membership" className="mt-3 block">
        <Button
          type="button"
          size="lg"
          className="h-12 w-full rounded-[16px] bg-[var(--app-pink)] text-[15.5px] font-extrabold text-white hover:bg-[var(--app-pink)]"
          style={{ boxShadow: '0 10px 24px rgba(216,27,114,0.30)' }}
        >
          멤버십으로 매일 더 보기
        </Button>
      </Link>

      {bundleHref ? (
        <>
          {/* 단품 vs 묶음 비교 — 두 라벨 모두 리졸버(usePriceLabel)에서 오므로
              가격이 바뀌어도 자동 정합. 주석에 금액을 적어두지 않는다(과거 stale 원인). */}
          <div className="mt-2 grid grid-cols-[1fr_1.35fr] gap-2">
            <Link href={singleHref} className="min-w-0">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="flex h-[3.25rem] w-full flex-col gap-0 rounded-[16px] border-[var(--app-pink-line)] bg-white px-2 text-[var(--app-pink-strong)] hover:bg-[var(--app-pink-soft)]"
              >
                <span className="text-[15px] font-extrabold leading-tight">{singleLabel} 단품</span>
                <span className="text-[12.1px] font-semibold text-[var(--app-copy-muted)]">오늘 자세히만</span>
              </Button>
            </Link>
            <Link href={bundleHref} className="min-w-0">
              <Button
                type="button"
                size="lg"
                className="flex h-[3.25rem] w-full flex-col gap-0 rounded-[16px] bg-[var(--app-pink)] px-2 text-white hover:bg-[var(--app-pink)]"
                style={{ boxShadow: '0 10px 24px rgba(216,27,114,0.30)' }}
              >
                <span className="flex items-center gap-1.5 leading-tight">
                  {/* 2026-07-19 — 할인특가 전환에 맞춰 취소선 원가 노출. 이게 없으면
                      compareAt(19,800)이 카탈로그에만 있고 화면에는 안 보여 "할인"이 전달되지 않는다. */}
                  <ComparePrice
                    priceKey="bundle_today_set"
                    className="text-[12.6px] font-bold text-white/70 line-through"
                  />
                  <span className="text-[16.7px] font-extrabold">{bundleLabel} 묶음</span>
                  {/* 실제 구성품: entitlement 6개(today-detail 1 + score-factor F1~F5 5개) =
                      점수는 5항목. 기존 '7종'·'점수 6종'은 오표기였다(checkout BUNDLE_GUIDE 기준). */}
                  <span className="text-[11.5px] font-semibold text-white/85">6종</span>
                </span>
                <span className="text-[12.1px] font-semibold text-white/85">오늘 + 점수 5항목 한 번에</span>
              </Button>
            </Link>
          </div>

          {/* 레거시 전 보유자에게만 전 열기 노출 */}
          {hasLegacyCoins ? (
            <button
              type="button"
              onClick={handleUnlockClick}
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full border border-[rgba(17,17,20,0.12)] bg-white px-4 py-2.5 text-[14.4px] font-bold text-[var(--app-copy-muted)] hover:bg-[rgba(17,17,20,0.04)] disabled:opacity-70"
            >
              {loading ? <span className="motion-spinner-inline" aria-hidden="true" /> : null}
              {loading ? '여는 중' : `${coinCost}전 열기`}
            </button>
          ) : null}

          {/* 옵션 설명 */}
          <ul className="mt-3 grid gap-1 text-[15px] leading-relaxed text-[var(--app-copy-muted)]">
            {hasLegacyCoins ? (
              <li>
                <b className="font-bold text-[var(--app-ink)]">{coinCost}전 열기</b> — 보유 전으로 오늘 자세히 보기
              </li>
            ) : null}
            <li>
              <b className="font-bold text-[var(--app-ink)]">{singleLabel} 단품</b> — 오늘 자세히 보기만 바로 결제
            </li>
            <li>
              <b className="font-bold text-[var(--app-pink-strong)]">{bundleLabel} 묶음</b> — 오늘 자세히 + 점수 5항목까지 한 번에
            </li>
          </ul>
        </>
      ) : (
        /* 묶음 없는 케이스 — 단품 보조 CTA */
        <div className="mt-2 grid gap-2">
          <Link href={singleHref} className="min-w-0">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-11 w-full rounded-full border-[var(--app-pink-line)] bg-white text-[15px] font-bold text-[var(--app-pink-strong)] hover:bg-[var(--app-pink-soft)]"
            >
              {singleLabel}으로 열기
            </Button>
          </Link>

          {/* 레거시 전 보유자에게만 전 열기 노출 */}
          {hasLegacyCoins ? (
            <button
              type="button"
              onClick={handleUnlockClick}
              disabled={loading}
              className="flex w-full items-center justify-center gap-1.5 rounded-full border border-[rgba(17,17,20,0.12)] bg-white px-4 py-2.5 text-[14.4px] font-bold text-[var(--app-copy-muted)] hover:bg-[rgba(17,17,20,0.04)] disabled:opacity-70"
            >
              {loading ? <span className="motion-spinner-inline" aria-hidden="true" /> : null}
              {loading ? '여는 중' : `${coinCost}전 열기`}
            </button>
          ) : null}
        </div>
      )}

      <p className="mt-3 text-[15px] leading-relaxed text-[var(--app-copy-muted)]">
        <Lock className="mr-1 inline h-3 w-3 align-[-1px]" />
        {copy}
      </p>

      {errorMessage ? (
        <p className="mt-3 text-[15px] text-[var(--app-coral)]">{errorMessage}</p>
      ) : null}
    </section>
  );
}
