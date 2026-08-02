// 카카오 친구추가 무료쿠폰 CTA — 상태기반(issuable/redeemable/redeemed/expired) 단일 컴포넌트.
// 진입점 4곳(배너/설정/오늘 자세히보기 체크아웃 등, Task 8 배선 예정)이 이 컴포넌트 하나를
// slug 유무만 다르게 넘겨 재사용한다. 휴면(KAKAO_FRIEND_COUPON_ENABLED off) 이면 상태 API 가
// { enabled:false } 를 반환하고, 이 컴포넌트는 그 즉시 아무것도 렌더하지 않는다 — 배선된
// 4곳 모두 코드 변경 없이 통째로 안 보이게 되는 것이 이 컴포넌트의 핵심 계약이다.
'use client';

import { useEffect, useState } from 'react';

type CouponCtaState = 'issuable' | 'redeemable' | 'redeemed' | 'expired';

interface CouponStatusResponse {
  enabled: boolean;
  state?: CouponCtaState;
  expiresAt?: string | null;
}

interface KakaoFriendCouponCtaProps {
  /** today-detail 체크아웃에서만 전달 — 있어야 redeem(즉시 무료지급) 버튼이 활성화된다. */
  slug?: string;
  scope?: string | null;
}

const START_URL = '/api/auth/kakao/coupon-verify/start';

const kakaoButtonStyle = {
  background: '#fee500',
  borderColor: 'rgba(0,0,0,0.06)',
  color: '#191919',
} as const;

export function KakaoFriendCouponCta({ slug, scope }: KakaoFriendCouponCtaProps) {
  const [status, setStatus] = useState<CouponStatusResponse | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/coupons/kakao-friend/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        setStatus(d && typeof d.enabled === 'boolean' ? d : { enabled: false });
      })
      .catch(() => {
        if (!cancelled) setStatus({ enabled: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function redeem() {
    if (!slug || redeeming) return;
    setRedeeming(true);
    try {
      const res = await fetch('/api/coupons/kakao-friend/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, scope: scope ?? '' }),
      });
      const d = await res.json().catch(() => null);
      if (res.ok && d?.ok && typeof d.redirect === 'string') {
        window.location.href = d.redirect;
        return;
      }
    } catch {
      // 아래 finally 에서 버튼을 되살린다 — 사용자가 다시 시도할 수 있게.
    }
    setRedeeming(false);
  }

  // 휴면(enabled:false)·미로드·fetch 실패 → 무동작. 이 한 줄이 "휴면 시 어디서도 안 보임" 계약.
  if (!status?.enabled) return null;

  if (status.state === 'issuable') {
    return (
      <a
        href={START_URL}
        className="mt-2 block w-full rounded-[10px] border px-3 py-2.5 text-center text-[14px] font-extrabold"
        style={kakaoButtonStyle}
      >
        카카오 친구추가하고 무료쿠폰 받기
      </a>
    );
  }

  if (status.state === 'redeemable') {
    if (slug) {
      return (
        <button
          type="button"
          onClick={redeem}
          disabled={redeeming}
          className="mt-2 w-full rounded-[10px] border px-3 py-2.5 text-[14px] font-extrabold disabled:opacity-60"
          style={kakaoButtonStyle}
        >
          무료 쿠폰 적용 · 3,300원 → 0원 · 무료로 받기
        </button>
      );
    }
    return (
      <p className="mt-2 text-[12.6px] font-bold text-[var(--app-copy-muted)]">
        무료 쿠폰이 있어요 · 오늘 자세히보기에서 사용
      </p>
    );
  }

  if (status.state === 'redeemed') {
    return (
      <p className="mt-2 text-[12.6px] font-bold text-[var(--app-copy-muted)]">무료 쿠폰 사용 완료</p>
    );
  }

  // expired → 조용히 무동작(쿠폰 재발급 경로 없음, 소음만 남기지 않는다).
  return null;
}
