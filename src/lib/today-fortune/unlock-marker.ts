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

// 2026-09-14 — 하루 1회에 막힌 다른 사람 사주의 결제 경로엔 무료 실행기록(run)이 없어, 결제 후 상세 스냅샷이
//   폼 이름을 모르고 계정 주인 이름으로 호명했다. 버튼이 reading 별로 폼 이름을 남기고
//   카드 결제는 결제 화면이 prepare → 주문 metadata.subjectName → 지급 스냅샷으로(2026-09-15), 멤버 열기는 상세가 unlock POST 로 넘긴다.
//   localStorage — 로그인·결제창 왕복(탭·팝업)을 건너야 한다. 결제 화면 URL 로 넘기지 않는 이유: 가족 이름이 방문 기록·login next·
//   접근 로그로 퍼진다(상세의 unlock GET 쿼리엔 폴백으로 실린다 — 카드 결제는 지급 스냅샷이 이미 이름을 가져 거의 안 쓰인다).
//   값은 표시 이름뿐이다(CodeQL #64 는 birth-profile JSON 왕복으로 프로필 전체가 오염 표시된 과대근사 — 오탐 처리).
// ponytail: 이 브라우저 한정. 결제를 다른 기기에서 열면 기존 폴백(계정 표시명).
const DETAIL_NAME_PREFIX = 'moonlight:today-detail:name:';

export function rememberTodayDetailName(readingId: string, name: string | null | undefined) {
  const trimmed = name?.trim();
  if (typeof window === 'undefined' || !trimmed) return;
  try {
    window.localStorage.setItem(`${DETAIL_NAME_PREFIX}${readingId}`, trimmed);
  } catch {
    // 저장소 차단 — 계정 표시명 폴백.
  }
}

export function readTodayDetailName(readingId: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(`${DETAIL_NAME_PREFIX}${readingId}`) ?? '';
  } catch {
    return '';
  }
}
