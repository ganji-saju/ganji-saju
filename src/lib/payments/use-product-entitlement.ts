// 2026-05-16 — 클라이언트 컴포넌트가 결제 button 노출 전에 entitlement 를 확인하는 hook.
// premium-lock-card, fortune-calendar-panel, compatibility-result-view,
// notification-center-page, saju/[slug]/* CTA 가 공유.
//
// 2026-05-16 A7 강화:
//   - initialEntitlement: 서버 props 가 결정한 entitlement state 를 초기값으로 받아
//     초기 paint 깜빡임 제거 (SSR 환경에서 권장)
//   - revalidateOnFocus / revalidateOnVisibility: 다른 탭에서 결제 후 돌아온 경우
//     CTA 가 실시간 반영 (focus/visibility 이벤트 시 자동 재요청)
//
// 사용법:
//   const { hasEntitlement, openHref, loading } = useProductEntitlement({
//     productId: 'today-detail',
//     slug: '...',
//     scope: 'general',
//     initialEntitlement: { hasEntitlement, openHref, reason }, // optional, SSR 권장
//   });
//
// 결과 사용:
//   - loading=true 동안은 비활성 상태로 두거나 결제 button 으로 그대로 노출 가능
//   - hasEntitlement=true → 결제 button 대신 "이미 구매" UI + openHref 로 이동
'use client';

import { useCallback, useEffect, useState } from 'react';

export interface InitialEntitlement {
  hasEntitlement: boolean;
  openHref: string | null;
  reason: string | null;
}

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
  /** 서버에서 결정한 초기 entitlement 상태. 있으면 첫 paint 깜빡임 제거.
   *  설정 시 loading=false 로 시작 + 이후 client revalidation 으로 갱신. */
  initialEntitlement?: InitialEntitlement;
  /** 창이 focus 될 때 자동 재요청. 다른 탭에서 결제 완료 후 돌아온 경우 실시간 반영. (default: true) */
  revalidateOnFocus?: boolean;
  /** document 가 visible 로 전환될 때 자동 재요청. 모바일 백그라운드 → 포그라운드 복귀 시 유용. (default: true) */
  revalidateOnVisibility?: boolean;
}

export interface ProductEntitlementResult {
  hasEntitlement: boolean;
  openHref: string | null;
  reason: string | null;
  loading: boolean;
  /** 명시적 재요청 trigger. 결제 확인 callback 등에서 호출. */
  refresh: () => void;
}

const EMPTY_INITIAL: InitialEntitlement = {
  hasEntitlement: false,
  openHref: null,
  reason: null,
};

export function useProductEntitlement({
  productId,
  slug,
  scope,
  plan,
  enabled = true,
  initialEntitlement,
  revalidateOnFocus = true,
  revalidateOnVisibility = true,
}: ProductEntitlementInput): ProductEntitlementResult {
  const hasInitial = Boolean(initialEntitlement);
  const initial = initialEntitlement ?? EMPTY_INITIAL;

  const [result, setResult] = useState<Omit<ProductEntitlementResult, 'refresh'>>({
    hasEntitlement: initial.hasEntitlement,
    openHref: initial.openHref,
    reason: initial.reason,
    // initialEntitlement 가 있으면 loading=false 로 시작 (SSR 일치 paint).
    // 없으면 enabled 일 때 loading=true 로 client fetch 진행.
    loading: hasInitial ? false : enabled,
  });

  // refresh: 명시적 재요청. 외부에서 결제 confirm 후 호출하면 즉시 갱신.
  const refresh = useCallback(() => {
    if (!enabled) return;

    const params = new URLSearchParams({ productId });
    if (slug) params.set('slug', slug);
    if (scope) params.set('scope', scope);
    if (plan) params.set('plan', plan);

    fetch(`/api/payments/entitlement?${params.toString()}`, {
      cache: 'no-store',
    })
      .then((res) => res.json())
      .then((data) => {
        setResult({
          hasEntitlement: Boolean(data?.hasEntitlement),
          openHref: typeof data?.openHref === 'string' ? data.openHref : null,
          reason: typeof data?.reason === 'string' ? data.reason : null,
          loading: false,
        });
      })
      .catch(() => {
        // 네트워크 실패 → 직전 state 유지 (결제 button 막지 않도록 fail-open).
        setResult((current) => ({ ...current, loading: false }));
      });
  }, [enabled, productId, slug, scope, plan]);

  // 초기 mount 시 fetch — initialEntitlement 없으면 첫 진실, 있으면 SSR 이후 갱신.
  useEffect(() => {
    if (!enabled) {
      setResult((current) => ({ ...current, loading: false }));
      return;
    }
    let cancelled = false;

    // initialEntitlement 가 없는 경우만 loading=true 표시 (있으면 그대로 초기값 유지).
    if (!hasInitial) {
      setResult((current) => ({ ...current, loading: true }));
    }

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
        // 네트워크 실패: initialEntitlement 있으면 그대로 유지, 없으면 false.
        if (hasInitial) {
          setResult({ ...initial, loading: false });
        } else {
          setResult({ hasEntitlement: false, openHref: null, reason: null, loading: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [productId, slug, scope, plan, enabled, hasInitial, initial.hasEntitlement, initial.openHref, initial.reason]);

  // focus / visibility revalidation — 다른 탭/창 결제 후 돌아온 경우 자동 갱신.
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;

    const onFocus = revalidateOnFocus ? refresh : null;
    const onVisible =
      revalidateOnVisibility && typeof document !== 'undefined'
        ? () => {
            if (document.visibilityState === 'visible') refresh();
          }
        : null;

    if (onFocus) window.addEventListener('focus', onFocus);
    if (onVisible) document.addEventListener('visibilitychange', onVisible);

    return () => {
      if (onFocus) window.removeEventListener('focus', onFocus);
      if (onVisible) document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, refresh, revalidateOnFocus, revalidateOnVisibility]);

  return { ...result, refresh };
}
