// 2026-05-16 — 클라이언트 컴포넌트가 결제 button 노출 전에 entitlement 를 확인하는 hook.
// premium-lock-card, fortune-calendar-panel, compatibility-result-view,
// notification-center-page 가 공유.
//
// 사용법:
//   const { hasEntitlement, openHref, loading } = useProductEntitlement({
//     productId: 'today-detail',
//     slug: '...',
//     scope: 'general',
//   });
//
// 결과 사용:
//   - loading=true 동안은 비활성 상태로 두거나 결제 button 으로 그대로 노출 가능
//   - hasEntitlement=true → 결제 button 대신 "이미 구매" UI + openHref 로 이동
'use client';

import { useEffect, useState } from 'react';

export interface ProductEntitlementInput {
  /** 'today-detail' | 'love-question' | 'money-pattern' | 'work-flow' |
   *  'monthly-calendar' | 'year-core' | 'lifetime-report' | 'subscription' */
  productId: string;
  slug?: string | null;
  scope?: string | null;
  /** subscription 전용: 'basic' | 'premium' | 'plus' */
  plan?: string | null;
  /** false 면 fetch 건너뜀 (예: SSR 단계, sessionId 미준비 등) */
  enabled?: boolean;
}

export interface ProductEntitlementResult {
  hasEntitlement: boolean;
  openHref: string | null;
  reason: string | null;
  loading: boolean;
}

export function useProductEntitlement({
  productId,
  slug,
  scope,
  plan,
  enabled = true,
}: ProductEntitlementInput): ProductEntitlementResult {
  const [result, setResult] = useState<ProductEntitlementResult>({
    hasEntitlement: false,
    openHref: null,
    reason: null,
    loading: enabled,
  });

  useEffect(() => {
    if (!enabled) {
      setResult((current) => ({ ...current, loading: false }));
      return;
    }

    let cancelled = false;
    setResult((current) => ({ ...current, loading: true }));

    const params = new URLSearchParams({ productId });
    if (slug) params.set('slug', slug);
    if (scope) params.set('scope', scope);
    if (plan) params.set('plan', plan);

    fetch(`/api/payments/entitlement?${params.toString()}`, {
      cache: 'no-store',
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setResult({
          hasEntitlement: Boolean(data?.hasEntitlement),
          openHref: typeof data?.openHref === 'string' ? data.openHref : null,
          reason: typeof data?.reason === 'string' ? data.reason : null,
          loading: false,
        });
      })
      .catch(() => {
        if (cancelled) return;
        // 네트워크 실패 시 결제 button 을 막지 않도록 false 로.
        setResult({ hasEntitlement: false, openHref: null, reason: null, loading: false });
      });

    return () => {
      cancelled = true;
    };
  }, [productId, slug, scope, plan, enabled]);

  return result;
}
