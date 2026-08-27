// 2026-08-26 — 관리자 지표 화면의 **기간 프리셋 단일 정본**.
//   그전엔 화면마다 제각각이었다: 누적지표 30/90/365 · 운영지표 7/14/30/60 ·
//   결제퍼널 7/14/30/60 · 대시보드 7/14/30 · 푸시CTR 7/14/30/90. 같은 날의 같은 지표를
//   화면을 옮기며 비교할 수 없는 상태였고, 하루치(오늘)와 6개월·1년은 어디에도 없었다.
//   사용자 지시(2026-08-26): "일단위, 주단위, 월단위, 분기별, 6개월, 1년".
//
//   ⚠️ 값은 **일수**다. 라벨의 '월'은 달력 월이 아니라 30일, '분기'는 90일, '1년'은 365일이다.
//   달력 경계(1일~말일) 집계가 필요해지면 그건 이 표가 아니라 롤업 쿼리를 바꿔야 한다 —
//   hint 에 일수를 같이 적어두는 이유다(라벨만 보고 달력 월로 오해하지 않게).

export interface AdminRangeOption {
  /** 윈도우 일수(오늘 포함). */
  value: number;
  /** 칩에 보이는 짧은 라벨. */
  label: string;
  /** 실제 일수 — 라벨의 '월/분기'가 달력 단위가 아님을 드러낸다. */
  hint: string;
}

export const ADMIN_RANGE_OPTIONS: readonly AdminRangeOption[] = [
  { value: 1, label: '일', hint: '오늘' },
  { value: 7, label: '주', hint: '7일' },
  { value: 30, label: '월', hint: '30일' },
  { value: 90, label: '분기', hint: '90일' },
  { value: 180, label: '6개월', hint: '180일' },
  { value: 365, label: '1년', hint: '365일' },
] as const;

export const ADMIN_RANGE_VALUES: readonly number[] = ADMIN_RANGE_OPTIONS.map((o) => o.value);

/** 지표 조회 상한 — 프리셋 최대값. 서버 clamp 도 이 값을 쓴다. */
export const ADMIN_RANGE_MAX_DAYS = 365;

/**
 * `?days=` 입력을 허용된 프리셋으로 정규화. 프리셋 밖 값은 fallback.
 * (임의 일수를 허용하면 화면마다 다른 축이 다시 생긴다 — 프리셋만 받는다.)
 */
export function normalizeAdminRange(raw: unknown, fallback = 30): number {
  const n = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : NaN;
  return ADMIN_RANGE_VALUES.includes(n) ? n : fallback;
}

/** '월(30일)' 형태의 표기. 프리셋 밖이면 'N일'. */
export function adminRangeLabel(days: number): string {
  const option = ADMIN_RANGE_OPTIONS.find((o) => o.value === days);
  return option ? `${option.label}(${option.hint})` : `${days}일`;
}
