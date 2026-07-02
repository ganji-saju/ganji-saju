// 광고성 정보(친구톡) 전송 법규 헬퍼 — 정보통신망법.
// 순수 함수(테스트 가능): 야간 발송 가드 + (광고) 표기·무료수신거부 포맷.

/**
 * 한국 야간 광고 발송 금지 시간대(21:00~익일 08:00 KST) 여부.
 * @param at 판정 기준 시각(기본은 호출측이 주입 — 테스트/결정성).
 */
export function isKakaoAdNightTime(at: Date): boolean {
  // KST = UTC+9. UTC 시각에서 KST 시(hour) 계산.
  const kstHour = (at.getUTCHours() + 9) % 24;
  return kstHour >= 21 || kstHour < 8;
}

/**
 * 광고성 친구톡 본문에 (광고) 표기 + 무료수신거부 안내 부착.
 * 이미 "(광고)"로 시작하면 중복 부착하지 않음.
 */
export function formatFriendtalkAd(body: string): string {
  const trimmed = body.trim();
  const withLabel = trimmed.startsWith('(광고)') ? trimmed : `(광고) ${trimmed}`;
  const optOut = '무료수신거부: 마이페이지 > 설정 > 카카오 알림 받기';
  return `${withLabel}\n\n${optOut}`;
}
