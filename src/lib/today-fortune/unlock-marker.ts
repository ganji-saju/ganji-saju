// 2026-05-17 PR #201 — 자동 POST → 사용자 액션 UX 리팩토링용 sessionStorage marker.
//
// 무료 페이지의 "1전 열기" 클릭 시 sourceSessionId 를 marker 로 저장.
// detail page mount 시 marker 확인 → 있으면 POST (deduct trigger), 없으면 GET (read-only).
// 새로고침 시 marker 없어서 GET → entitlement true 면 content, false 면 redirect.
//
// PR #199 (daily idempotency) / PR #200 (정확한 kind) 의 server-side backstop 위에
// client-side intent 명시 layer. 새로고침이 read-only 임을 코드 의도로 명확히.

export const UNLOCK_PENDING_KEY = 'moonlight:today-fortune:unlock-pending';

export function markPendingUnlock(sourceSessionId: string) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(UNLOCK_PENDING_KEY, sourceSessionId);
  } catch {
    // sessionStorage 비활성 (private mode 등) — 무시. server-side idempotency 가 backstop.
  }
}

export function consumePendingUnlock(sourceSessionId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const pending = window.sessionStorage.getItem(UNLOCK_PENDING_KEY);
    if (pending === sourceSessionId) {
      window.sessionStorage.removeItem(UNLOCK_PENDING_KEY);
      return true;
    }
  } catch {
    // 무시.
  }
  return false;
}
