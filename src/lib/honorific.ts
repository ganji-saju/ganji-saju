// 2026-10-09 — 호칭 계산을 서버·클라이언트 공용 모듈로 분리.
//   web-push.ts(서버)가 'use client' 모듈(onboarding-storage)에서 이 함수를 가져오면
//   Next 가 클라이언트 참조로 바꿔 서버에서 호출 시 예외를 던진다
//   ("Attempted to call getHonorificLabel() from the server ...").
//   그 예외가 /api/notifications/dispatch 루프 밖에서 터져 첫 수신자에서 크론 전체가 중단됐다
//   (2026-07-12~ 웹푸시·알림 이메일·구독 만료 안내 전부 미발송).
//   이 파일에는 'use client' 를 넣지 말 것.
export function getHonorificLabel(nickname: string) {
  const trimmed = nickname.trim();
  if (!trimmed) return '선생님';
  if (trimmed.endsWith('님') || trimmed.endsWith('선생님')) return trimmed;
  return `${trimmed} 선생님`;
}
