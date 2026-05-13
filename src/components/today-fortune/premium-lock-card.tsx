'use client';

import { Lock } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { trackMoonlightEvent } from '@/lib/analytics';
import { formatPriceLabel } from '@/lib/payments/catalog';

// P1-2 fix (audit 2026-05-13): "550원" 하드코딩 → catalog SSOT lookup
const TODAY_DETAIL_PRICE = formatPriceLabel('taste_today_detail');

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
  return (
    <section className="relative overflow-hidden rounded-[1.8rem] border border-[var(--app-pink-line)] bg-white p-6 shadow-[0_18px_52px_rgba(216,27,114,0.1)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,79,154,0.13),transparent_42%)]" />
      <div className="relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="app-caption">더 자세히 보기</div>
            <h3 className="mt-3 text-xl font-bold tracking-tight text-[var(--app-ink)]">오늘 자세히 보기</h3>
          </div>
          <span className="rounded-full border border-[var(--app-pink-line)] bg-[var(--app-pink-soft)] px-3 py-1 text-xs font-bold text-[var(--app-pink-strong)]">
            {TODAY_DETAIL_PRICE} 또는 {coinCost}코인
          </span>
        </div>
        <p className="mt-4 text-sm leading-8 text-[var(--app-copy)]">{copy}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[
            '오늘 조심할 시간대',
            '피할 말과 추천 행동',
            '지금 바로 할 작은 선택',
          ].map((item) => (
            <div
              key={item}
              className="rounded-[1.05rem] border border-[var(--app-line)] bg-[var(--app-pink-soft)] px-4 py-4 text-sm font-medium text-[var(--app-copy)]"
            >
              {item}
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-3">
          <Button
            type="button"
            disabled={loading}
            onClick={() => {
              trackMoonlightEvent('unlock_clicked', {
                from: 'today-fortune',
                concern: concernId,
                sourceSessionId,
                productCode: 'TODAY_DETAIL_VIEW',
              });
              onUnlock();
            }}
            size="lg"
            className="min-h-14 w-full rounded-full bg-[var(--app-pink)] text-base font-medium text-white shadow-[0_14px_32px_rgba(216,27,114,0.22)] hover:bg-[var(--app-pink-strong)]"
          >
            <Lock className="mr-2 h-4 w-4" />
            {loading ? '열어보는 중...' : '1코인으로 열기'}
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href={`/membership/checkout?product=today-detail&slug=${encodeURIComponent(sourceSessionId)}&scope=${encodeURIComponent(concernId)}&from=today-fortune`}
              className="min-w-0"
            >
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="min-h-[3.25rem] w-full rounded-full border-[var(--app-pink-line)] bg-white text-sm font-medium text-[var(--app-pink-strong)] hover:bg-[var(--app-pink-soft)]"
              >
                {TODAY_DETAIL_PRICE} 바로 열기
              </Button>
            </Link>
            <Link href="/credits?from=today-fortune" className="min-w-0">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="min-h-[3.25rem] w-full rounded-full border-[rgba(17,17,20,0.12)] bg-[var(--app-ink)] text-sm font-medium text-white hover:bg-[rgba(17,17,20,0.86)] hover:text-white"
              >
                코인 충전 보기
              </Button>
            </Link>
          </div>
        </div>
        {errorMessage ? (
          <p className="mt-4 text-sm text-[var(--app-coral-text)]">{errorMessage}</p>
        ) : null}
      </div>
    </section>
  );
}
