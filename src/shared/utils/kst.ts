/**
 * KST (Asia/Seoul, UTC+9, DST 없음) 시간 처리 통합 유틸 — Phase 2 (2026-05-18).
 *
 * 배경:
 *   - Vercel 서버 = UTC. 페이지 SSR 코드에서 `new Date().getDate()` 류 raw 호출 시
 *     KST 자정~오전 9시 사이에 어제 값 노출 (audit P0 #3, #4).
 *   - 기존 KST 유틸 4종 (getKoreaAccessDay / getKoreaDateKey / getSeoulDateKey /
 *     toKstDateKey) 가 모듈별로 분산. 본 모듈로 통합.
 *
 * 모든 함수는 KST 시간대로 계산. 호출자는 `new Date().getXxx()` 직접 사용 금지.
 */

export const KST_TIMEZONE = 'Asia/Seoul';
export const KST_LOCALE = 'ko-KR';
const SV_LOCALE = 'sv-SE'; // sv-SE 는 YYYY-MM-DD 포맷을 보장

/**
 * 현재 시각 Date 객체. `new Date()` 와 동일하지만, "KST 컨텍스트에서 사용하겠다"
 * 는 의도를 명시하는 의미상 helper. (Date 자체는 internally UTC milliseconds)
 */
export function getKstNow(): Date {
  return new Date();
}

/**
 * KST 시간대 YYYY-MM-DD 문자열. cache key / seed / sitemap lastmod 등에 사용.
 *
 * @example
 *   UTC 2026-05-17T20:00:00Z (= KST 2026-05-18T05:00) → "2026-05-18"
 *   UTC 2026-05-17T14:59:00Z (= KST 2026-05-17T23:59) → "2026-05-17"
 *   UTC 2026-05-17T15:00:00Z (= KST 2026-05-18T00:00) → "2026-05-18"
 */
export function getKstDateKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat(SV_LOCALE, {
    timeZone: KST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * KST 시간대 컴포넌트 분해 — `new Date().getDate() / getMonth() / getFullYear()` 직접
 * 사용 대체. 모두 KST 시간대 원칙.
 *
 * @returns {
 *   year: 4자리 연도 (예: 2026),
 *   month: 1~12 (Date.getMonth() 와 달리 1-indexed),
 *   day: 1~31,
 *   hour: 0~23,
 *   minute: 0~59,
 *   weekday: 0=일~6=토 (Date.getDay() 와 동일)
 * }
 */
export function getKstParts(date: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
} {
  // dateKey 로 year/month/day 추출 (YYYY-MM-DD)
  const dateKey = getKstDateKey(date);
  const [yearStr, monthStr, dayStr] = dateKey.split('-');

  // 시/분 — Intl 로 추출
  const hmFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: KST_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const [hourStr, minuteStr] = hmFormatter.format(date).split(':');

  // 요일 — KST 의 year/month/day 를 UTC 자정으로 구성해 getUTCDay() 사용.
  // (KST 자정 instant 의 getUTCDay 는 KST 의 전날 UTC 를 반환하므로 사용 불가)
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

  return {
    year,
    month,
    day,
    hour: Number(hourStr === '24' ? '0' : hourStr), // en-GB 가 자정을 24:00 으로 표기하는 케이스 방어
    minute: Number(minuteStr),
    weekday,
  };
}

/**
 * KST 시간대 자정 (00:00:00) 시각의 Date 객체.
 * 반환된 Date 는 UTC 시간대 instant 이지만 KST 자정에 대응.
 *
 * @example
 *   2026-05-18 KST 자정 → UTC 2026-05-17T15:00:00.000Z 의 Date 객체
 */
export function getKstStartOfDay(date: Date = new Date()): Date {
  const dateKey = getKstDateKey(date);
  return new Date(`${dateKey}T00:00:00+09:00`);
}

/**
 * 한국어 인간 친화 날짜 포맷. 기본: "2026년 5월 18일 (월)"
 *
 * @param opts.weekday 요일 포함 여부 (기본 true)
 * @param opts.style   'long' (2026년 5월 18일) | 'short' (5월 18일) | 'numeric' (2026.05.18)
 */
export function formatKoreanDate(
  date: Date = new Date(),
  opts: { weekday?: boolean; style?: 'long' | 'short' | 'numeric' } = {}
): string {
  const { weekday = true, style = 'long' } = opts;
  const parts = getKstParts(date);

  let core: string;
  if (style === 'numeric') {
    core = `${parts.year}.${String(parts.month).padStart(2, '0')}.${String(parts.day).padStart(2, '0')}`;
  } else if (style === 'short') {
    core = `${parts.month}월 ${parts.day}일`;
  } else {
    core = `${parts.year}년 ${parts.month}월 ${parts.day}일`;
  }

  if (!weekday) return core;
  const weekdayLabel = ['일', '월', '화', '수', '목', '금', '토'][parts.weekday];
  return `${core} (${weekdayLabel})`;
}

/**
 * 데일리 콘텐츠 버전 — cache key, ISR revalidate, 알림 dedup 등에 사용.
 * 현재는 `getKstDateKey()` 와 동일. 의미상 helper.
 *
 * 모든 데일리 페이지 (홈 오늘 한 줄 / 오늘운세 / 타로 / 띠운세 / 별자리 / 알림 / 데일리 리마인더)
 * 가 동일 값을 받게 한다.
 */
export function getDailyVersion(date: Date = new Date()): string {
  return getKstDateKey(date);
}
