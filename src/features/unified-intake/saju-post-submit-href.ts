// 사주 제출 후 이동 href 를 계산하는 PURE 빌더.
// 구 위저드(saju-intake-page.tsx buildPostSubmitHref, git 71edd70)의 유료 퍼널 분기를
// 그대로 이식 — /saju/new?product=/?plan= 딥링크가 /membership/checkout 으로 라우팅되던 동작.
// 순수 함수라 window 의존이 없어 node 환경 vitest 로 회귀 커버 가능.
import { NEW_YEAR_TARGET_YEAR, type TasteProductId } from '@/lib/payments/catalog';
import type { OnboardingFocusTopic } from '@/features/saju-intake/onboarding-storage';

// saju-intake-page.tsx getCurrentYearMonthScope 이식 — `${YYYY}-${MM}`.
function getCurrentYearMonthScope() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export interface SajuPostSubmitHrefOptions {
  focusTopic: OnboardingFocusTopic;
  product: TasteProductId | null;
  plan: 'lifetime' | null;
  from: string;
}

export function buildSajuPostSubmitHref(id: string, opts: SajuPostSubmitHrefOptions): string {
  const { focusTopic, product, plan, from } = opts;

  if (plan === 'lifetime') {
    const params = new URLSearchParams({ plan, slug: id, from });
    return `/membership/checkout?${params.toString()}`;
  }

  // 2026-09-26 — 신년운세는 결제 전에 미리보기(한눈에·키워드)를 먼저 보여 준다. 판매 중단된 year-core 구 딥링크도 여기로.
  if (product === 'new-year' || product === 'year-core') {
    return `/saju/${id}/new-year/${NEW_YEAR_TARGET_YEAR}?from=${from}`;
  }

  if (
    product === 'monthly-calendar' ||
    product === 'money-pattern' ||
    product === 'work-flow'
  ) {
    const params = new URLSearchParams({ product, slug: id, from });
    if (product === 'monthly-calendar') params.set('scope', getCurrentYearMonthScope());
    return `/membership/checkout?${params.toString()}`;
  }

  return `/saju/${id}?from=${from}&topic=${focusTopic}`;
}
