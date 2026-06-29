// 2026-06-30 — "포커스 체크아웃": 결제(payment) 화면에서는 하단 글로벌 크롬
//   (모바일 dock, "맨 위로" FAB)을 숨겨 결제 중 이탈·주의분산을 줄이고,
//   화면 하단에 고정된 결제 CTA(StickyCheckoutCta) 하나만 남긴다.
//   토스·쿠팡·네이버 등 표준 결제 플로우와 동일한 패턴.
//
//   라우트 기반으로 판단한다(특정 페이지에 props 를 내려보내지 않아도 nav 가 스스로 인지).

const FOCUSED_CHECKOUT_ROUTES = ['/membership/checkout', '/credits', '/pay'] as const;

export function isFocusedCheckoutRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return FOCUSED_CHECKOUT_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}
