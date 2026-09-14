'use client';

// 2026-09-14 — 하루 1회 안내 아래 결제 경로(사용자 결정: "결제 경로를 줘").
//   무료 1회를 쓴 뒤 다른 사람(가족 등) 사주를 넣으면 안내만 뜨고 막다른 길이었다.
//   그 입력의 오늘 자세히를 바로 결제 화면으로 보낸다(무료 결과·무료 1회 소비 없음).
//   이미 오늘 산 사람은 결제 화면이 '이미 구매한 풀이' 로 바로 열어 준다(checkTodayDetailAccess).
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { usePriceLabel } from '@/components/payments/price-provider';
import type { UnifiedBirthProfile } from '@/features/unified-intake/birth-profile-store';
import { prepareTodayDetailCheckout } from '@/features/unified-intake/submit-today';

export function TodayDetailCheckoutButton({
  profile,
  concernId,
  from,
}: {
  profile: UnifiedBirthProfile;
  concernId?: string;
  from: string;
}) {
  const router = useRouter();
  const priceLabel = usePriceLabel('saju_entry');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      router.push(await prepareTodayDetailCheckout(profile, { concernId, from }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '결제 화면을 여는 중 오류가 있었어요.');
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <p className="text-[14.4px] leading-[1.6] text-[var(--app-copy)]">
        방금 입력한 분의 오늘 운세는 결제하면 자세히 볼 수 있어요.
      </p>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="gangi-primary-button disabled:opacity-70"
      >
        {busy
          ? '결제 화면으로 가는 중'
          : priceLabel
            ? `${priceLabel}으로 오늘 자세히 보기`
            : '오늘 자세히 보기'}
      </button>
      {error ? (
        <p className="text-[14.4px] font-medium text-[var(--app-coral,#e11d48)]">{error}</p>
      ) : null}
    </div>
  );
}
