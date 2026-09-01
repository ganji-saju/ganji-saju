// 2026-09-01 — 관리자 지표 **달력 기간** 정본.
//   그전(metric-ranges.ts)은 `days=30` 처럼 **오늘 기준 롤링 창**뿐이었다. 그래서
//   "8월 15일 하루", "8/31~9/6 주", "3월 한 달", "2분기", "2027년" 같은
//   **지난 기간 지정**이 아예 불가능했다(끝점이 항상 오늘로 고정).
//   사용자 지시(2026-09-01): 일=날짜 선택 · 주=월~일 · 월=1~12월 · 분기=1·2·3·4 · 년=연도.
//
//   ⚠️ 축은 전부 KST(한국 시간) 날짜키 'YYYY-MM-DD'. KST 는 서머타임이 없어
//   'YYYY-MM-DDT00:00:00Z' UTC 산술로 안전하게 날짜 계산이 된다.

export type AdminPeriodUnit = 'day' | 'week' | 'month' | 'quarter' | 'year';

export interface AdminPeriodUnitOption {
  unit: AdminPeriodUnit;
  /** 칩 라벨. */
  label: string;
}

export const ADMIN_PERIOD_UNITS: readonly AdminPeriodUnitOption[] = [
  { unit: 'day', label: '일' },
  { unit: 'week', label: '주' },
  { unit: 'month', label: '월' },
  { unit: 'quarter', label: '분기' },
  { unit: 'year', label: '년' },
] as const;

export interface AdminPeriod {
  unit: AdminPeriodUnit;
  /** 기간 식별자 — day '2026-09-01' · week 월요일키 · month '2026-09' · quarter '2026-Q3' · year '2026'. */
  anchor: string;
  /** 기간 첫날(KST 날짜키). */
  startKey: string;
  /** 기간 마지막날(KST 날짜키). **오늘을 넘지 않는다**(미래는 집계가 없다). */
  endKey: string;
  /** startKey~endKey 일수(양끝 포함) — 기존 집계의 windowDays 자리에 그대로 들어간다. */
  days: number;
  /** 화면 표기 ('2026년 9월', '8월 31일~9월 6일' 등). */
  label: string;
}

const DAY_MS = 86_400_000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const isKey = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const parseKey = (key: string) => new Date(Date.parse(`${key}T00:00:00Z`));
const fmtKey = (d: Date) => d.toISOString().slice(0, 10);
const shiftKey = (key: string, days: number) => fmtKey(new Date(parseKey(key).getTime() + days * DAY_MS));

/** 오늘(KST) 날짜키. */
export function kstTodayKey(now: Date = new Date()): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 날짜키의 **다음날 KST 자정** ISO — 쿼리 상한(`.lt`)에 쓴다(그날 23:59:59 포함). */
export function kstExclusiveEndIso(endKey: string): string {
  return new Date(Date.parse(`${shiftKey(endKey, 1)}T00:00:00+09:00`)).toISOString();
}

/**
 * 날짜키 → 그 날 KST 정오의 Date. `now` 인자만 받는 기존 집계 함수
 * (getDailyMetrics·getRefundBreakdown)에 '기간 마지막 날'을 넘길 때 쓴다.
 * 정오를 쓰는 이유: 자정은 UTC 변환 경계라 하루 밀릴 위험이 있다.
 */
export function kstNoonDate(dateKey: string): Date {
  return new Date(Date.parse(`${dateKey}T12:00:00+09:00`));
}

/** 그 날이 속한 주의 **월요일** 날짜키. */
export function mondayKeyOf(key: string): string {
  const dow = parseKey(key).getUTCDay(); // 0=일
  return shiftKey(key, -((dow + 6) % 7));
}

const inclusiveDays = (startKey: string, endKey: string) =>
  Math.max(1, Math.round((parseKey(endKey).getTime() - parseKey(startKey).getTime()) / DAY_MS) + 1);

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function rawBounds(unit: AdminPeriodUnit, anchor: string): { startKey: string; endKey: string } {
  if (unit === 'day') return { startKey: anchor, endKey: anchor };
  if (unit === 'week') return { startKey: anchor, endKey: shiftKey(anchor, 6) };
  if (unit === 'month') {
    const [y, m] = anchor.split('-').map(Number);
    const startKey = `${anchor}-01`;
    const endKey = shiftKey(fmtKey(new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1))), -1);
    return { startKey, endKey };
  }
  if (unit === 'quarter') {
    const [ys, qs] = anchor.split('-Q');
    const y = Number(ys);
    const q = Number(qs);
    const startMonth = (q - 1) * 3 + 1;
    const startKey = `${y}-${String(startMonth).padStart(2, '0')}-01`;
    const endKey = shiftKey(fmtKey(new Date(Date.UTC(q === 4 ? y + 1 : y, q === 4 ? 0 : startMonth + 2, 1))), -1);
    return { startKey, endKey };
  }
  return { startKey: `${anchor}-01-01`, endKey: `${anchor}-12-31` };
}

function labelFor(unit: AdminPeriodUnit, anchor: string, startKey: string, rawEndKey: string): string {
  if (unit === 'day') {
    const d = parseKey(anchor);
    return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일(${WEEKDAYS[d.getUTCDay()]})`;
  }
  if (unit === 'week') {
    const s = parseKey(startKey);
    const e = parseKey(rawEndKey);
    return `${s.getUTCMonth() + 1}월 ${s.getUTCDate()}일~${e.getUTCMonth() + 1}월 ${e.getUTCDate()}일`;
  }
  if (unit === 'month') {
    const [y, m] = anchor.split('-').map(Number);
    return `${y}년 ${m}월`;
  }
  if (unit === 'quarter') {
    const [y, q] = anchor.split('-Q').map(Number);
    return `${y}년 ${q}분기(${(q - 1) * 3 + 1}~${q * 3}월)`;
  }
  return `${anchor}년`;
}

/** anchor 문자열이 그 단위의 형식인지. 아니면 오늘이 속한 기간으로 되돌린다. */
function normalizeAnchor(unit: AdminPeriodUnit, raw: unknown, todayKey: string): string {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (unit === 'day') return isKey(s) ? s : todayKey;
  if (unit === 'week') return isKey(s) ? mondayKeyOf(s) : mondayKeyOf(todayKey);
  if (unit === 'month') return /^\d{4}-(0[1-9]|1[0-2])$/.test(s) ? s : todayKey.slice(0, 7);
  if (unit === 'quarter') {
    if (/^\d{4}-Q[1-4]$/.test(s)) return s;
    return `${todayKey.slice(0, 4)}-Q${Math.floor((Number(todayKey.slice(5, 7)) - 1) / 3) + 1}`;
  }
  return /^\d{4}$/.test(s) ? s : todayKey.slice(0, 4);
}

export function normalizeAdminPeriodUnit(raw: unknown): AdminPeriodUnit {
  const s = typeof raw === 'string' ? raw : '';
  return ADMIN_PERIOD_UNITS.some((o) => o.unit === s) ? (s as AdminPeriodUnit) : 'day';
}

/**
 * `?unit=&period=` 입력 → 실제 달력 구간. 기본은 **오늘 하루**(사용자 지시: 일 기준이 먼저).
 * 끝은 오늘로 자른다 — 미래 날짜를 축에 그리면 빈 칸이 데이터 누락처럼 보인다.
 */
export function resolveAdminPeriod(
  rawUnit: unknown,
  rawAnchor: unknown,
  now: Date = new Date()
): AdminPeriod {
  const todayKey = kstTodayKey(now);
  const unit = normalizeAdminPeriodUnit(rawUnit);
  const anchor = normalizeAnchor(unit, rawAnchor, todayKey);
  const { startKey, endKey: rawEnd } = rawBounds(unit, anchor);
  const endKey = rawEnd > todayKey ? todayKey : rawEnd;
  return {
    unit,
    anchor,
    startKey,
    // 시작이 미래인 기간(다음 연도 등)은 축이 뒤집히지 않게 시작으로 눌러 둔다.
    endKey: endKey < startKey ? startKey : endKey,
    days: inclusiveDays(startKey, endKey < startKey ? startKey : endKey),
    label: labelFor(unit, anchor, startKey, rawEnd),
  };
}

/** 이전/다음 기간의 anchor. 다음이 미래면 null(버튼을 숨긴다). */
export function shiftAdminPeriod(period: AdminPeriod, delta: -1 | 1, now: Date = new Date()): string | null {
  const todayKey = kstTodayKey(now);
  const { unit, anchor } = period;
  let next: string;
  if (unit === 'day') next = shiftKey(anchor, delta);
  else if (unit === 'week') next = shiftKey(anchor, 7 * delta);
  else if (unit === 'month') {
    const [y, m] = anchor.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    next = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  } else if (unit === 'quarter') {
    const [y, q] = anchor.split('-Q').map(Number);
    const idx = y * 4 + (q - 1) + delta;
    next = `${Math.floor(idx / 4)}-Q${(idx % 4) + 1}`;
  } else next = String(Number(anchor) + delta);
  return rawBounds(unit, next).startKey > todayKey ? null : next;
}

/** 셀렉트 박스용 목록(최신 → 과거). 일 단위는 `<input type="date">` 라 목록이 없다. */
export function adminPeriodChoices(
  unit: AdminPeriodUnit,
  now: Date = new Date()
): Array<{ value: string; label: string }> {
  const counts: Record<Exclude<AdminPeriodUnit, 'day'>, number> = {
    week: 26,
    month: 24,
    quarter: 12,
    year: 5,
  };
  if (unit === 'day') return [];
  const out: Array<{ value: string; label: string }> = [];
  let cursor = resolveAdminPeriod(unit, undefined, now);
  for (let i = 0; i < counts[unit]; i += 1) {
    out.push({ value: cursor.anchor, label: cursor.label });
    const prev = shiftAdminPeriod(cursor, -1, now);
    if (!prev) break;
    cursor = resolveAdminPeriod(unit, prev, now);
  }
  return out;
}
