// 2026-05-16 A7 — 페이지 단위 entitlement 실시간 갱신.
//
// 사용 시나리오: 페이지 전체가 entitlement 에 따라 다수 conditional 분기를 갖는 경우
// (예: /saju/[slug]/premium 의 heroLabel/readingSteps/sections 등). 개별 CTA 만 client
// 마이그레이션하기보다 focus 시 router.refresh() 로 server component 재렌더링.
//
// 동작:
//   1. 마운트 시 server 가 전달한 initialHasEntitlement 를 보관.
//   2. window focus / document visibility=visible 이벤트 발생 시 /api/payments/entitlement
//      재요청.
//   3. 결과가 initialHasEntitlement 와 다르면 router.refresh() 호출 → 서버 컴포넌트가
//      새 entitlement 로 페이지 전체 다시 그림.
//   4. fetch 실패 시 무시 (silent — UI 깨짐 0).
//
// 비고:
//   - 본 컴포넌트 자체는 render output 없음 (effect-only).
//   - 동일 페이지에 여러 productId 가 영향을 미치는 경우 productId 별로 여러 개 마운트 가능.
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

interface Props {
  /** 'today-detail' | 'love-question' | 'money-pattern' | 'work-flow' |
   *  'monthly-calendar' | 'year-core' | 'lifetime-report' | 'subscription' */
  productId: string;
  slug?: string | null;
  scope?: string | null;
  /** subscription 전용: 'basic' | 'premium' | 'plus' */
  plan?: string | null;
  /** 서버 컴포넌트가 SSR 시점에 계산한 entitlement 보유 여부. */
  initialHasEntitlement: boolean;
}

export function EntitlementRefresher({
  productId,
  slug,
  scope,
  plan,
  initialHasEntitlement,
}: Props) {
  const router = useRouter();
  // 매 fetch 후 비교 기준이 되는 "최근 확인된 server-side state". router.refresh() 후엔
  // 서버가 새로 전달한 initialHasEntitlement 가 들어옴.
  const lastConfirmedRef = useRef(initialHasEntitlement);
  lastConfirmedRef.current = initialHasEntitlement;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams({ productId });
    if (slug) params.set('slug', slug);
    if (scope) params.set('scope', scope);
    if (plan) params.set('plan', plan);

    const check = async () => {
      try {
        const res = await fetch(`/api/payments/entitlement?${params.toString()}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = (await res.json()) as { hasEntitlement?: boolean } | null;
        const next = Boolean(data?.hasEntitlement);
        if (next !== lastConfirmedRef.current) {
          // 서버 SSR 결과와 다르다 → 페이지 server component 재실행.
          router.refresh();
        }
      } catch {
        // 네트워크 실패 무시.
      }
    };

    const onFocus = () => {
      void check();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [productId, slug, scope, plan, router]);

  return null;
}
