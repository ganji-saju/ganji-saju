// 할인쿠폰 관리자 조작(PR6 — /admin/coupons, super_admin). 판정은 순수 함수, DB 는 service 를 주입받는다.
//
// 설계: docs/discount-coupon-design.md §2·§11·§12 · 사용자 결정 2026-09-13(귀속 해제 = 계정을 푼다 · 코드 목록 재다운로드 ·
//   요율 소급·만료 일괄 변경·회수 되살리기 포함 · 085 접두=등급 CHECK).
// 🔴 쿠폰 코드는 무기명 현금 증서다. 이 파일의 어떤 함수도 코드 평문을 로그·감사 meta·오류 메시지에 싣지 않는다.
//    코드가 서버 밖으로 나가는 길은 CSV 내보내기 하나뿐이다(couponCsv — 감사 기록이 먼저 성공해야 한다).
// ⚠️ 이 파일에 `\u` 이스케이프를 쓰지 말 것 — 편집 도구가 원시 문자로 바꿔 저장해 git 이 바이너리로 본 적이 있다(2026-09-13).
//    보이지 않는 문자는 `\p{…}` 정규식과 String.fromCodePoint 로만 다룬다.
import { randomInt as cryptoRandomInt } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildAccessLogInsert, type AccessLogInput } from '@/lib/admin/access-log';
import { dailyPeriodKey } from '@/lib/credits/member-benefits';
import { readPaymentOrigin } from '@/lib/payments/payment-origin';
import {
  COUPON_TIERS,
  couponDeadReason,
  formatCouponCode,
  orderHoldsCoupon,
  parseCouponCode,
  STAGING_TEST_BATCH,
  type CouponEnv,
  type CouponRow,
  type CouponTier,
} from './discount-coupon';

/**
 * 이 모듈이 던지는 오류 — message 는 **고정 문구**라 관리자 화면에 그대로 보여 줘도 된다(코드·행 원문 없음).
 * 액션은 이 클래스만 message 를 내보이고, 그 밖의 오류는 일반 문구로 바꾼다.
 */
export class CouponAdminError extends Error {}

/** 상한 하한(원). 1원 상한 = 사실상 0원 쿠폰에 계정이 "동시에 1개"로 묶인다(0% 를 금지한 이유와 같다). ⚠️ 운영 보정. */
export const COUPON_MIN_CAP_WON = 1_000;
/**
 * 1회 발급 상한 = 한 문장 insert(원자적 — 반만 들어가는 일이 없다). 오타(0 하나 더) 브레이크이기도 하다:
 * 발급량이 곧 추측 성공률(발급량/10,000)이라, 인쇄 안 할 코드도 공격 표적이 된다(설계 §11).
 */
export const COUPON_ISSUE_MAX = 1_000;
export const COUPON_BATCH_NAME_MAX = 40;
/** 만료 상한(오늘부터 일). 만료 없는 50% 쿠폰 1장 = 멤버십 매달 24,500원 영구 손실(설계 §11-A D). ⚠️ 운영 보정. */
export const COUPON_EXPIRY_MAX_DAYS = 730;
/** 태우기 신호: 24시간 귀속이 이만큼(또는 발급의 5%) 이상인데 그 코드들의 결제 비율이 10% 미만. ⚠️ 운영 보정. */
export const COUPON_BURN_MIN_BINDS_24H = 20;
const SERIAL_SPACE = 10_000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 'YYYY-MM-DD'(KST) → 그날 23:59:59 KST 의 ISO. 079 기본값('2027-12-31T14:59:59+00:00')과 같은 규칙. 없는 날짜는 null. */
export function kstEndOfDayIso(date: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const at = new Date(Date.UTC(y, mo - 1, d, 14, 59, 59));
  return at.getUTCFullYear() === y && at.getUTCMonth() === mo - 1 && at.getUTCDate() === d ? at.toISOString() : null;
}

/**
 * 0000~9999 중 이미 쓴 번호를 뺀 나머지에서 count 개를 **무작위로** 뽑는다(부분 Fisher–Yates, 비복원).
 * 순차 발급이면 전단 한 장으로 이웃 번호를 추측한다 — 성공률을 발급량/10,000 로 묶는 게 무작위의 몫이다(설계 §11).
 * `randomInt(max)` 는 [0, max) 정수. 호출부 기본값은 node:crypto 의 randomInt(비암호 난수 금지 — 추측 가능, 가드 테스트가 막는다).
 */
export function pickSerials(count: number, takenSerials: ReadonlySet<string>, randomInt: (max: number) => number): string[] {
  if (!Number.isInteger(count) || count < 1) throw new CouponAdminError('발급 수량은 1 이상의 정수여야 합니다.');
  const free: string[] = [];
  for (let n = 0; n < SERIAL_SPACE; n += 1) {
    const serial = String(n).padStart(4, '0');
    if (!takenSerials.has(serial)) free.push(serial);
  }
  if (free.length < count) throw new CouponAdminError(`이 등급에 남은 번호가 ${free.length}개뿐입니다(요청 ${count}개).`);
  for (let i = 0; i < count; i += 1) {
    const j = i + randomInt(free.length - i);
    [free[i], free[j]] = [free[j], free[i]];
  }
  return free.slice(0, count);
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function toInt(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : NaN;
  return Number.isInteger(n) ? n : null;
}

function isChecked(raw: unknown): boolean {
  return raw === true || raw === 'on' || raw === 'true';
}

export interface TierInput {
  tier: CouponTier;
  percent: number;
  /** null = 상한 없음. */
  maxDiscountWon: number | null;
}

/**
 * 등급 요율·상한 입력. DB CHECK(079)와 같은 범위 — percent 1..50(0 금지: 끄기는 disabled_at), 상한은 하한 이상 정수.
 * 🔴 "상한 없음"은 noCap 체크로만 — 빈 칸을 null 로 받으면 요율만 고치려던 소급 한 번에 전 귀속자의 손실 브레이크가 풀린다.
 */
export function validateTierInput(input: {
  tier: unknown;
  percent: unknown;
  maxDiscountWon: unknown;
  noCap?: unknown;
}): Result<TierInput> {
  const tier = COUPON_TIERS.find((t) => t === input.tier);
  if (!tier) return { ok: false, error: '등급이 올바르지 않습니다.' };
  const percent = toInt(input.percent);
  if (percent == null || percent < 1 || percent > 50) return { ok: false, error: '할인율은 1~50 사이 정수여야 합니다.' };
  if (isChecked(input.noCap)) return { ok: true, value: { tier, percent, maxDiscountWon: null } };
  const cap = toInt(input.maxDiscountWon);
  if (cap == null || cap < COUPON_MIN_CAP_WON) {
    return {
      ok: false,
      error: `상한은 ${COUPON_MIN_CAP_WON.toLocaleString('ko-KR')}원 이상 정수로 넣거나 "상한 없음"을 체크해 주세요.`,
    };
  }
  return { ok: true, value: { tier, percent, maxDiscountWon: cap } };
}

// 제어·서식 문자(줄바꿈·탭·zero-width·BOM 등) — CSV·감사 로그를 깨고, 눈으로는 같은 배치명을 둘 만든다.
const INVISIBLE = /[\p{Cc}\p{Cf}]/u;

/**
 * 배치명 정규형: NFC(맥에서 붙여 넣은 NFD 한글이 다른 이름이 되지 않게) · 앞뒤 공백 제거 · 연속 공백 1개.
 * 발급·회수·되살리기·만료 변경의 확인 입력도 이 함수로 맞춘다. 못 쓰는 이름이면 null.
 */
export function normalizeBatchName(raw: unknown): string | null {
  if (typeof raw !== 'string' || INVISIBLE.test(raw)) return null;
  const name = raw.normalize('NFC').trim().replace(/\s+/g, ' ');
  return name && name.length <= COUPON_BATCH_NAME_MAX ? name : null;
}

function isStagingTestLike(name: string): boolean {
  return name.toLowerCase().replace(/[\s_]+/g, '-') === STAGING_TEST_BATCH;
}

export interface IssueInput {
  tier: CouponTier;
  count: number;
  batch: string;
  /** ISO — KST 그날 23:59:59. */
  expiresAt: string;
}

/**
 * 대량 발급 입력. 환경마다 만들 수 있는 배치가 다르다(같은 DB — 설계 §6):
 *   production = 실물 배치만(staging-test·유사명 거부 — 인쇄되면 운영에서 먹히지 않는 전단이 된다)
 *   test(staging·로컬) = staging-test 만(실물 배치를 만들면 프로덕션에서 그대로 먹힌다) · null(preview·모름) = 거부.
 */
export function validateIssueInput(
  input: { tier: unknown; count: unknown; batch: unknown; expiresOn: unknown },
  env: CouponEnv,
  now: Date
): Result<IssueInput> {
  if (!env) return { ok: false, error: '이 배포에서는 쿠폰을 발급할 수 없습니다(운영·staging 만).' };
  const tier = COUPON_TIERS.find((t) => t === input.tier);
  if (!tier) return { ok: false, error: '등급이 올바르지 않습니다.' };
  const count = toInt(input.count);
  if (count == null || count < 1 || count > COUPON_ISSUE_MAX) {
    return { ok: false, error: `수량은 1~${COUPON_ISSUE_MAX.toLocaleString('ko-KR')} 사이 정수여야 합니다.` };
  }
  const batch = normalizeBatchName(input.batch);
  if (!batch) return { ok: false, error: `배치 이름은 1~${COUPON_BATCH_NAME_MAX}자, 줄바꿈·특수 공백 없이 입력해 주세요.` };
  if (env === 'production' && isStagingTestLike(batch)) {
    return { ok: false, error: `'${STAGING_TEST_BATCH}' 는 테스트 전용 이름이라 운영에서 쓸 수 없습니다.` };
  }
  if (env === 'test' && batch !== STAGING_TEST_BATCH) {
    return { ok: false, error: `이 배포에서는 '${STAGING_TEST_BATCH}' 배치만 발급할 수 있습니다.` };
  }
  const expires = validateExpiresOn(input.expiresOn, now);
  if (!expires.ok) return expires;
  return { ok: true, value: { tier, count, batch, expiresAt: expires.value } };
}

/** 만료일(KST 'YYYY-MM-DD') → 그날 23:59:59 KST ISO. 내일부터 오늘+상한일 사이만 — 발급·배치 만료 변경 공용. */
export function validateExpiresOn(raw: unknown, now: Date): Result<string> {
  const expiresOn = typeof raw === 'string' ? raw : '';
  const expiresAt = kstEndOfDayIso(expiresOn);
  const today = dailyPeriodKey(now);
  const latest = dailyPeriodKey(new Date(now.getTime() + COUPON_EXPIRY_MAX_DAYS * DAY_MS));
  if (!expiresAt || expiresOn <= today || expiresOn > latest) {
    return { ok: false, error: `만료일은 내일(KST)부터 ${latest} 사이여야 합니다.` };
  }
  return { ok: true, value: expiresAt };
}

/**
 * 관리자 쓰기용 쿠폰 환경. 체크아웃 판정(couponEnvForHost)에 한 겹을 더한다: 호스트가 운영이어도 **운영 배포**
 * (VERCEL_ENV=production)가 아니면 null — 로컬 dev 는 프로덕션 service 키를 쓰는데 Host 헤더를 마음대로 정할 수 있다.
 */
export function adminCouponEnv(hostEnv: CouponEnv, vercelEnv: string | undefined): CouponEnv {
  if (hostEnv === 'production') return vercelEnv === 'production' ? 'production' : null;
  return hostEnv;
}

/** 이 환경이 이 배치를 건드려도 되는가 — 운영은 전부, staging·로컬(test)은 staging-test 만, 모름(null)은 없음. */
export function batchAllowedInEnv(batch: string | null, env: CouponEnv): boolean {
  if (env === 'production') return true;
  return env === 'test' && batch === STAGING_TEST_BATCH;
}

/** 감사 기록·화면용. `ganji-10-**34` — 등급당 후보 100개라 행을 특정하지 못한다(재식별은 스탬프로 한다). */
export function maskCouponCode(code: string): string {
  const parsed = parseCouponCode(code);
  return parsed ? `ganji-${parsed.tier}-**${parsed.serial.slice(2)}` : '(형식 오류)';
}

/** 사람이 쓴 사유 등에 섞인 코드를 가린다(감사 로그 reason 에 평문이 남지 않게). */
export function scrubCouponCodes(text: string): string {
  return text.replace(/ganji[\s\-_]*(10|20|30|40|50)[\s\-_]*\d{4}/gi, (_, tier: string) => `ganji-${tier}-****`);
}

// ─────────────────────────────────────────────────────────────
// 현황 집계(순수). 화면으로 내려가는 값이라 코드 평문을 담지 않는다.
// ─────────────────────────────────────────────────────────────

export interface AdminTierRow {
  tier: string;
  percent: number;
  max_discount_won: number | null;
  disabled_at: string | null;
  /** 🔴 PostgREST 원문 문자열 — 동시 편집 CAS 토큰이라 Date 로 바꾸지 않는다(µs 가 잘리면 비교가 깨진다). */
  updated_at: string;
  updated_by: string | null;
}

export interface AdminCouponRow extends CouponRow {
  tier: string;
  created_at: string;
}

export interface AdminCouponOrder {
  id: string;
  coupon_code: string;
  status: string;
  amount: number;
  discount_won: number;
  created_at: string;
  metadata: unknown;
}

export type CouponAdminState = 'unbound' | 'live' | 'released' | 'disabled' | 'expired';

/** 배타 분류 — 겹치면 released > disabled(행·등급) > expired. 죽음 판정은 정본 couponDeadReason 그대로. */
export function couponState(row: CouponRow, now: Date): CouponAdminState {
  if (row.released_at) return 'released';
  const dead = couponDeadReason(row, now);
  if (dead) return dead;
  return row.bound_user_id ? 'live' : 'unbound';
}

// analytics-rollup 의 완료 상태와 같다(confirmed·fulfilling·fulfilled). 환불은 따로 센다.
const COMPLETED = new Set(['confirmed', 'fulfilling', 'fulfilled']);

/**
 * 실매출 결제인가 — origin 이 **production** 인 것만. 쿠폰 주문은 전부 origin 기록 이후라 unknown(허용목록 밖 호스트)을
 * 매출로 볼 이유가 없다(hasPaidHistory 와 같은 기준 — 낯선 호스트의 샌드박스 결제가 섞이지 않게).
 */
function isProductionOrder(order: AdminCouponOrder): boolean {
  return readPaymentOrigin(order.metadata).env === 'production';
}

export interface CouponBatchStat {
  batch: string;
  isTest: boolean;
  tiers: string[];
  issued: number;
  unbound: number;
  live: number;
  released: number;
  disabled: number;
  expired: number;
  /** 행의 disabled_at 서로 다른 값(원문) — 되살리기 대상. 개별 코드 회수 기능이 없어 전부 배치 회수에서 온다. */
  disabledStamps: string[];
  expiresMin: string | null;
  expiresMax: string | null;
  firstIssuedAt: string | null;
  /** 24시간 안에 귀속된 코드 수(코드당 24시간에 한 번만 귀속될 수 있어 정확하다). */
  bound24h: number;
  /** 최근 7일 — '최근 귀속 시각 기준'(24h 회수·재귀속이 bound_at 을 덮어써 7일 누적 건수가 아니다). */
  boundRecent7d: number;
  paidOrders: number;
  paidAmount: number;
  discountWon: number;
  refundedOrders: number;
  /** 24시간 안에 귀속된 코드 중 결제완료가 있는 코드 수. */
  paidCodes24h: number;
  burnSignal: boolean;
}

/** 배치별 현황과 태우기 신호. 탈퇴 계정의 주문은 cascade 로 지워져 결제에서 빠진다(화면에 명시). */
export function couponBatchStats(rows: AdminCouponRow[], orders: AdminCouponOrder[], now: Date): CouponBatchStat[] {
  const byBatch = new Map<string, CouponBatchStat>();
  const batchOfCode = new Map<string, CouponBatchStat>();
  const bound24hCodes = new Set<string>();
  const since24h = now.getTime() - DAY_MS;
  const since7d = now.getTime() - 7 * DAY_MS;
  const earlier = (a: string | null, b: string) => (a == null || Date.parse(b) < Date.parse(a) ? b : a);
  const later = (a: string | null, b: string) => (a == null || Date.parse(b) > Date.parse(a) ? b : a);

  for (const row of rows) {
    const key = row.batch ?? '(배치 없음)';
    let stat = byBatch.get(key);
    if (!stat) {
      stat = {
        batch: key,
        isTest: row.batch === STAGING_TEST_BATCH,
        tiers: [],
        issued: 0,
        unbound: 0,
        live: 0,
        released: 0,
        disabled: 0,
        expired: 0,
        disabledStamps: [],
        expiresMin: null,
        expiresMax: null,
        firstIssuedAt: null,
        bound24h: 0,
        boundRecent7d: 0,
        paidOrders: 0,
        paidAmount: 0,
        discountWon: 0,
        refundedOrders: 0,
        paidCodes24h: 0,
        burnSignal: false,
      };
      byBatch.set(key, stat);
    }
    batchOfCode.set(row.code, stat);
    stat.issued += 1;
    stat[couponState(row, now)] += 1;
    if (!stat.tiers.includes(row.tier)) stat.tiers.push(row.tier);
    if (row.disabled_at && !stat.disabledStamps.includes(row.disabled_at)) stat.disabledStamps.push(row.disabled_at);
    stat.expiresMin = earlier(stat.expiresMin, row.expires_at);
    stat.expiresMax = later(stat.expiresMax, row.expires_at);
    stat.firstIssuedAt = earlier(stat.firstIssuedAt, row.created_at);
    const boundAt = row.bound_at ? Date.parse(row.bound_at) : NaN;
    if (boundAt >= since24h) {
      stat.bound24h += 1;
      bound24hCodes.add(row.code);
    }
    if (boundAt >= since7d) stat.boundRecent7d += 1;
  }

  const paidCodes = new Set<string>();
  for (const order of orders) {
    const stat = batchOfCode.get(order.coupon_code);
    if (!stat || !isProductionOrder(order)) continue;
    if (order.status === 'refunded') stat.refundedOrders += 1;
    if (!COMPLETED.has(order.status)) continue;
    stat.paidOrders += 1;
    stat.paidAmount += order.amount;
    stat.discountWon += order.discount_won;
    paidCodes.add(order.coupon_code);
  }
  for (const code of paidCodes) {
    if (bound24hCodes.has(code)) batchOfCode.get(code)!.paidCodes24h += 1;
  }
  for (const stat of byBatch.values()) {
    const threshold = Math.max(COUPON_BURN_MIN_BINDS_24H, Math.ceil(stat.issued * 0.05));
    stat.burnSignal = stat.bound24h >= threshold && stat.paidCodes24h / stat.bound24h < 0.1;
  }
  // 최근 발급 배치가 위, 테스트 배치는 맨 아래.
  return [...byBatch.values()].sort(
    (a, b) => Number(a.isTest) - Number(b.isTest) || Date.parse(b.firstIssuedAt ?? '') - Date.parse(a.firstIssuedAt ?? '')
  );
}

export interface CouponTierStat {
  tier: string;
  percent: number;
  maxDiscountWon: number | null;
  disabledAt: string | null;
  /** CAS 토큰(원문). */
  updatedAt: string;
  updatedBy: string | null;
  issued: number;
  remaining: number;
  /** 추측 성공률 = 발급량 / 10,000(설계 §11). */
  guessRate: number;
  /** 자리를 차지한 귀속(released 제외 — 회수·만료 포함) = 소급 대상. */
  boundHeld: number;
  boundHeldTest: number;
  /** 그중 스냅샷이 현재 요율·상한과 다른 수 — 소급하면 바뀌는 고객 수, 소급 뒤 남으면 경합(재실행으로 수렴). */
  snapshotStale: number;
}

export function couponTierStats(tiers: AdminTierRow[], rows: AdminCouponRow[]): CouponTierStat[] {
  return COUPON_TIERS.flatMap((tierKey) => {
    const t = tiers.find((row) => row.tier === tierKey);
    if (!t) return [];
    const mine = rows.filter((row) => row.tier === tierKey);
    const held = mine.filter((row) => row.bound_user_id && !row.released_at);
    return [
      {
        tier: tierKey,
        percent: t.percent,
        maxDiscountWon: t.max_discount_won,
        disabledAt: t.disabled_at,
        updatedAt: t.updated_at,
        updatedBy: t.updated_by,
        issued: mine.length,
        remaining: SERIAL_SPACE - mine.length,
        guessRate: mine.length / SERIAL_SPACE,
        boundHeld: held.length,
        boundHeldTest: held.filter((row) => row.batch === STAGING_TEST_BATCH).length,
        snapshotStale: held.filter(
          (row) =>
            row.bound_percent != null &&
            (row.bound_percent !== t.percent || (row.bound_max_discount_won ?? null) !== (t.max_discount_won ?? null))
        ).length,
      },
    ];
  });
}

// ─────────────────────────────────────────────────────────────
// CSV(인쇄소 전달용). 코드가 서버 밖으로 나가는 유일한 형식.
// ─────────────────────────────────────────────────────────────

const STATE_LABEL: Record<CouponAdminState, string> = {
  unbound: '미사용',
  live: '사용 중',
  released: '해제됨',
  disabled: '회수됨',
  expired: '만료',
};

function csvCell(value: string): string {
  // 수식 주입 방지 — 스프레드시트가 = + - @ 로 시작하는 셀을 수식으로 실행한다.
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function couponCsv(rows: { code: string; state: CouponAdminState; expires_at: string }[]): string {
  const bom = String.fromCodePoint(0xfeff); // Excel 이 UTF-8 한글을 알아보게
  const lines = rows.map((row) =>
    [formatCouponCode(row.code), STATE_LABEL[row.state], dailyPeriodKey(new Date(row.expires_at))].map(csvCell).join(',')
  );
  return `${bom}${['코드,상태,만료일(KST)', ...lines].join('\n')}\n`;
}

/** 파일명엔 배치명의 글자·숫자만(경로 문자·수식 문자 제거). 다운로드 폴더·동기화 폴더에 캠페인명이 길게 남지 않게 20자. */
export function couponCsvFileName(batch: string, now: Date): string {
  const safe = batch.normalize('NFC').replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 20) || 'batch';
  return `ganji-coupons-${dailyPeriodKey(now).replace(/-/g, '')}-${safe}.csv`;
}

// ─────────────────────────────────────────────────────────────
// DB 조작(service 주입 — RLS on·정책 없음이라 세션 클라이언트는 오류 없이 0행을 준다).
// 🔴 오류는 고정 문구로만 던진다. Postgres 는 message·details 에 입력·행 원문(= 코드)을 담아 돌려준다(23505·22P02).
//    로그에는 error.code 만 남긴다.
// 🔴 행을 지우지 않는다(079 — 감사 보존·PK 재발급 방지). released_at 을 되돌리지 않는다(080 종료 상태).
//    bound_user_id 를 비우지 않는다(080 — 이미 쓴 전단이 남에게 재귀속된다).
// ─────────────────────────────────────────────────────────────

type DbError = { code?: string } | null;
interface KeysetQuery {
  gt(col: string, value: string): KeysetQuery;
  order(col: string): KeysetQuery;
  limit(n: number): PromiseLike<{ data: unknown; error: DbError }>;
}

const PAGE = 1_000;
// 등급 5 × 10,000 = 최대 50,000 행 + 여유. 넘으면 부분 목록을 쓰지 않고 멈춘다(인쇄 CSV·발급 번호 제외 목록이 틀린다).
// ponytail: 전량 로드 — 발급이 2만 장을 넘어 화면이 느려지면 배치별 SQL 집계로.
const MAX_PAGES = 60;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;
const isIso = (v: unknown): v is string => typeof v === 'string' && ISO_RE.test(v) && Number.isFinite(Date.parse(v));

/** 관리자 화면이 읽는 쿠폰 열 — 체크아웃과 같은 행 모양(COUPON_ROW_COLUMNS) + 등급·발급 시각. */
const ADMIN_COUPON_COLUMNS =
  'code, tier, batch, bound_user_id, bound_at, bound_percent, bound_max_discount_won, expires_at, disabled_at, released_at, created_at, coupon_tiers(percent, max_discount_won, disabled_at)';

function dbFail(op: string, error: DbError, message: string): never {
  console.error(`[coupon-admin] ${op} 실패`, error?.code ?? 'unknown');
  throw new CouponAdminError(message);
}

/**
 * 불변 키(PK) 기준 keyset 페이지네이션. 🔴 ORDER BY 없는 LIMIT/OFFSET 은 페이지 사이에 귀속 UPDATE 가 끼면
 * 행이 옮겨 가 인쇄 CSV 에 같은 코드가 두 번 실리거나 빠진다(요구 4 — 인쇄 후엔 되돌릴 수 없다).
 */
async function fetchAllByKey<T>(base: () => KeysetQuery, key: string, op: string): Promise<T[]> {
  const out: T[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query: KeysetQuery = after == null ? base() : base().gt(key, after);
    const { data, error } = await query.order(key).limit(PAGE);
    if (error) dbFail(op, error, '쿠폰 목록을 읽지 못했습니다.');
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
    after = String((rows[rows.length - 1] as Record<string, unknown>)[key]);
  }
  throw new CouponAdminError('쿠폰 목록이 너무 커서 끝까지 읽지 못했습니다(부분 목록은 쓰지 않습니다).');
}

function assertBatchAllowed(batch: string, env: CouponEnv, verb: string): void {
  if (!env) throw new CouponAdminError(`이 배포에서는 쿠폰을 ${verb} 수 없습니다(운영·staging 만).`);
  if (!batchAllowedInEnv(batch, env)) throw new CouponAdminError(`이 배포에서는 '${STAGING_TEST_BATCH}' 배치만 ${verb} 수 있습니다.`);
}

/**
 * test 환경이면 쿼리 자체에도 staging-test 필터를 건다 — 사전 확인과 UPDATE 사이가 비지 않게(이중 방어).
 * (Q 에 제약을 걸면 supabase 빌더 타입 추론이 TS2589 로 터진다 — 안에서만 좁힌다.)
 */
function scopeToEnv<Q>(query: Q, env: CouponEnv): Q {
  if (env !== 'test') return query;
  return (query as unknown as { eq(col: string, value: string): Q }).eq('batch', STAGING_TEST_BATCH);
}

export interface CouponAdminData {
  tiers: AdminTierRow[];
  rows: AdminCouponRow[];
  orders: AdminCouponOrder[];
}

/** 화면 집계용 전량 로드. 결과를 그대로 클라이언트로 넘기지 말 것(코드 평문) — 집계 함수를 거쳐 내린다. */
export async function loadCouponAdminData(service: SupabaseClient): Promise<CouponAdminData> {
  const { data: tiers, error } = await service
    .from('coupon_tiers')
    .select('tier, percent, max_discount_won, disabled_at, updated_at, updated_by');
  if (error) dbFail('등급 조회', error, '등급을 읽지 못했습니다.');
  const rows = await fetchAllByKey<AdminCouponRow>(
    () => service.from('discount_coupons').select(ADMIN_COUPON_COLUMNS) as unknown as KeysetQuery,
    'code',
    '쿠폰 조회'
  );
  const raw = await fetchAllByKey<Omit<AdminCouponOrder, 'metadata'> & { origin: unknown }>(
    () =>
      service
        .from('payment_orders')
        .select('id, coupon_code, status, amount, discount_won, created_at, origin:metadata->origin')
        .not('coupon_code', 'is', null) as unknown as KeysetQuery,
    'id',
    '쿠폰 주문 조회'
  );
  const orders = raw.map(({ origin, ...order }) => ({ ...order, metadata: { origin } }));
  return { tiers: (tiers ?? []) as AdminTierRow[], rows, orders };
}

export interface IssueResult {
  count: number;
  batch: string;
  tier: CouponTier;
  expiresAt: string;
  /** 이번 insert 의 created_at — 감사 기록과 행을 잇는 재식별 키(코드 대신). */
  createdAt: string;
}

/**
 * 대량 발급. 등급의 기존 번호(모든 배치·상태, 페이지 끝까지)를 뺀 나머지에서 무작위로 뽑아 **한 문장** insert 한다.
 * upsert 금지(merge 면 귀속된 행을 덮어써 고객 쿠폰이 날아간다) · 재시도 루프 없음(한 문장이라 전부 아니면 0 —
 * 충돌은 동시 발급뿐이라 "다시 누르세요"면 된다). 반환값에 코드가 없다 — 코드는 exportCouponBatch 로만 나간다.
 * 배치명이 이미 있으면 거부, "기존 배치에 추가"(append)일 때만 허용(CS 1장 재발급·재인쇄 보충). staging-test 는 반복 허용.
 * ponytail: 이름 확인 → insert 사이 경합(두 관리자가 같은 새 이름을 동시에) 은 막지 않는다 — 필요하면 배치 테이블 PK 로.
 */
export async function issueCouponBatch(
  service: SupabaseClient,
  input: IssueInput & { append: boolean },
  actorId: string,
  env: CouponEnv,
  opts: { randomInt?: (max: number) => number; now?: Date } = {}
): Promise<IssueResult> {
  assertBatchAllowed(input.batch, env, '발급할');
  if (env === 'production' && isStagingTestLike(input.batch)) {
    throw new CouponAdminError(`'${STAGING_TEST_BATCH}' 는 테스트 전용 이름이라 운영에서 쓸 수 없습니다.`);
  }
  const now = opts.now ?? new Date();
  const nowIso = now.toISOString();
  if (input.batch !== STAGING_TEST_BATCH) {
    const { count, error } = await service
      .from('discount_coupons')
      .select('code', { count: 'exact', head: true })
      .eq('batch', input.batch);
    if (error) dbFail('배치 확인', error, '배치 이름을 확인하지 못했습니다.');
    if ((count ?? 0) > 0 && !input.append) {
      throw new CouponAdminError('이미 있는 배치 이름입니다. 같은 배치에 더하려면 "기존 배치에 추가"를 켜 주세요.');
    }
    if ((count ?? 0) === 0 && input.append) throw new CouponAdminError('추가할 배치가 없습니다. 배치 이름을 확인해 주세요.');
  }
  const taken = await fetchAllByKey<{ code: string }>(
    () => service.from('discount_coupons').select('code').eq('tier', input.tier) as unknown as KeysetQuery,
    'code',
    '발급 번호 조회'
  );
  const serials = pickSerials(input.count, new Set(taken.map((row) => row.code.slice(7))), opts.randomInt ?? cryptoRandomInt);
  const { error } = await service.from('discount_coupons').insert(
    serials.map((serial) => ({
      code: `ganji${input.tier}${serial}`, // 🔴 접두는 이 한 곳에서 tier 로 만든다(085 CHECK 가 DB 에서도 막는다)
      tier: input.tier,
      batch: input.batch,
      expires_at: input.expiresAt,
      created_at: nowIso,
      created_by: actorId,
    }))
  );
  if (error?.code === '23505') dbFail('발급', error, '다른 발급과 겹쳤어요. 다시 눌러 주세요(이번 요청으로 발급된 코드는 없습니다).');
  if (error?.code === '23514') dbFail('발급', error, '코드 형식 검사(085)에 걸려 발급하지 않았습니다.');
  if (error) dbFail('발급', error, '발급하지 못했습니다(이번 요청으로 발급된 코드는 없습니다).');
  return { count: serials.length, batch: input.batch, tier: input.tier, expiresAt: input.expiresAt, createdAt: nowIso };
}

/** 배치 회수 — 그 배치의 **아직 살아 있는** 행에만 이번 스탬프를 찍는다(앞선 회수의 스탬프를 덮지 않아야 되살리기가 정확하다). */
export async function revokeCouponBatch(
  service: SupabaseClient,
  batch: string,
  env: CouponEnv,
  now: Date = new Date()
): Promise<{ count: number; stamp: string }> {
  assertBatchAllowed(batch, env, '회수할');
  const stamp = now.toISOString();
  const { count, error } = await scopeToEnv(
    service.from('discount_coupons').update({ disabled_at: stamp }, { count: 'exact' }).eq('batch', batch).is('disabled_at', null),
    env
  );
  if (error) dbFail('배치 회수', error, '회수하지 못했습니다.');
  return { count: count ?? 0, stamp };
}

/**
 * 회수 되살리기 — **그 스탬프**가 찍힌 행만(DB 원문 문자열 그대로 비교 — Date 로 바꾸면 µs 가 잘려 0행).
 * released 행은 couponDeadReason 이 계속 막는다(080 종료 상태 — 회수 중 새 코드로 옮긴 계정의 옛 쿠폰은 돌아오지 않는다).
 */
export async function restoreCouponBatch(
  service: SupabaseClient,
  batch: string,
  stamp: string,
  env: CouponEnv
): Promise<{ count: number }> {
  assertBatchAllowed(batch, env, '되살릴');
  if (!isIso(stamp)) throw new CouponAdminError('그 회수 기록을 찾지 못했습니다. 새로고침 후 다시 시도해 주세요.');
  const { count, error } = await scopeToEnv(
    service.from('discount_coupons').update({ disabled_at: null }, { count: 'exact' }).eq('batch', batch).eq('disabled_at', stamp),
    env
  );
  if (error) dbFail('회수 되살리기', error, '되살리지 못했습니다.');
  if (!count) throw new CouponAdminError('그 회수 기록을 찾지 못했습니다. 새로고침 후 다시 시도해 주세요.');
  return { count };
}

/** 배치 만료일 일괄 변경. 이전 범위를 돌려준다(감사 meta — 되돌릴 근거). released 행은 바꿔도 계속 죽어 있다. */
export async function setCouponBatchExpiry(
  service: SupabaseClient,
  batch: string,
  expiresAt: string,
  env: CouponEnv
): Promise<{ count: number; oldMin: string | null; oldMax: string | null }> {
  assertBatchAllowed(batch, env, '바꿀');
  if (!isIso(expiresAt)) throw new CouponAdminError('만료일 형식이 올바르지 않습니다.');
  const rows = await fetchAllByKey<{ code: string; expires_at: string }>(
    () => scopeToEnv(service.from('discount_coupons').select('code, expires_at').eq('batch', batch), env) as unknown as KeysetQuery,
    'code',
    '만료 조회'
  );
  const times = rows.map((row) => row.expires_at).sort((a, b) => Date.parse(a) - Date.parse(b));
  const { count, error } = await scopeToEnv(
    service.from('discount_coupons').update({ expires_at: expiresAt }, { count: 'exact' }).eq('batch', batch),
    env
  );
  if (error) dbFail('만료 변경', error, '만료일을 바꾸지 못했습니다.');
  return { count: count ?? 0, oldMin: times[0] ?? null, oldMax: times[times.length - 1] ?? null };
}

export type HolderLookup =
  | { found: false }
  | {
      found: true;
      maskedCode: string;
      batch: string | null;
      state: CouponAdminState;
      holder: string | null;
      holderEmail: string | null;
      /** 가입 경로(kakao·google·email) — 같은 사람의 두 계정인지 판단하는 근거. */
      providers: string[];
      holderCreatedAt: string | null;
      /** 🔴 원문 — 해제 CAS 토큰. 24h 회수·재귀속 때마다 바뀐다. */
      boundAt: string | null;
      /** 결제 중(prepared 미만료·in_progress) — 해제하면 카드 인증 뒤 승인 관문에서 거부된다. */
      pendingOrders: number;
      completedOrders: number;
    };

/**
 * [귀속 해제] 전 조회. 입력 = 코드 | 사용자 UUID | 이메일(정확히 일치). 🔴 코드 평문은 응답에 넣지 않는다.
 * test 환경에서 실물 행은 "없음"(체크아웃의 env_mismatch → not_found 와 같은 규칙). 형식이 틀린 입력은 쿼리에 넣지 않는다(22P02 가 원문을 되돌려 준다).
 * ponytail: 이메일은 첫 200명 목록에서 찾는다(searchAdminUsers 와 같은 한계) — 가입자가 늘면 UUID 로.
 */
export async function lookupCouponHolder(
  service: SupabaseClient,
  query: string,
  env: CouponEnv,
  now: Date = new Date()
): Promise<HolderLookup> {
  if (!env) throw new CouponAdminError('이 배포에서는 쿠폰을 조회할 수 없습니다(운영·staging 만).');
  const q = query.trim();
  const parsed = parseCouponCode(q);
  let userId: string | null = null;
  if (!parsed && UUID_RE.test(q)) userId = q.toLowerCase();
  if (!parsed && !userId && q.includes('@')) {
    const { data, error } = await service.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) dbFail('사용자 검색', { code: error.code }, '사용자를 찾지 못했습니다.');
    const email = q.toLowerCase();
    userId = data.users.find((user) => (user.email ?? '').toLowerCase() === email)?.id ?? null;
    if (!userId) return { found: false };
  }
  if (!parsed && !userId) throw new CouponAdminError('쿠폰 코드·사용자 UUID·이메일 중 하나를 넣어 주세요.');

  const base = scopeToEnv(service.from('discount_coupons').select(ADMIN_COUPON_COLUMNS), env);
  const { data, error } = await (parsed
    ? base.eq('code', parsed.code)
    : base.eq('bound_user_id', userId!).is('released_at', null)
  ).maybeSingle();
  if (error) dbFail('해제 조회', error, '쿠폰을 조회하지 못했습니다.');
  const row = data as AdminCouponRow | null;
  if (!row || !batchAllowedInEnv(row.batch, env)) return { found: false };

  const holder = row.bound_user_id;
  let holderEmail: string | null = null;
  let providers: string[] = [];
  let holderCreatedAt: string | null = null;
  let pendingOrders = 0;
  let completedOrders = 0;
  if (holder) {
    const { data: user } = await service.auth.admin.getUserById(holder);
    holderEmail = user?.user?.email ?? null;
    providers = [...new Set((user?.user?.identities ?? []).map((identity) => identity.provider))];
    holderCreatedAt = user?.user?.created_at ?? null;
    const { data: orders, error: orderError } = await service
      .from('payment_orders')
      .select('status, expires_at')
      .eq('coupon_code', row.code)
      .eq('user_id', holder);
    if (orderError) dbFail('해제 조회', orderError, '주문을 조회하지 못했습니다.');
    for (const order of (orders ?? []) as { status: string; expires_at: string | null }[]) {
      if (order.status === 'in_progress' || (order.status === 'prepared' && orderHoldsCoupon(order, now))) pendingOrders += 1;
      if (COMPLETED.has(order.status)) completedOrders += 1;
    }
  }
  return {
    found: true,
    maskedCode: maskCouponCode(row.code),
    batch: row.batch,
    state: couponState(row, now),
    holder,
    holderEmail,
    providers,
    holderCreatedAt,
    boundAt: row.bound_at,
    pendingOrders,
    completedOrders,
  };
}

/**
 * [귀속 해제] = 계정을 푼다(사용자 결정 2026-09-13): 보유자가 **지금 차지한** 쿠폰에 released_at(종료 상태).
 * 코드는 영구 종료, 계정은 새 코드를 쓸 수 있다. 키는 (보유자, bound_at) — 코드를 몰라도 되고, 조회 뒤 그 계정이
 * 다른 쿠폰으로 옮겼거나 24h 회수로 남에게 넘어갔으면 bound_at 이 달라 0행이다(엉뚱한 쿠폰을 종료하지 않는다).
 * 사용자 경로(bindCouponClaim)의 보상 되돌림은 자기 스탬프만 되돌리므로 관리자 해제를 덮지 않는다.
 */
export async function releaseHeldCoupon(
  service: SupabaseClient,
  holder: string,
  boundAt: string,
  env: CouponEnv,
  now: Date = new Date()
): Promise<{ maskedCode: string; batch: string | null; releasedAt: string }> {
  if (!env) throw new CouponAdminError('이 배포에서는 쿠폰을 해제할 수 없습니다(운영·staging 만).');
  const changed = '상태가 바뀌었어요. 다시 조회한 뒤 해제해 주세요.';
  if (!UUID_RE.test(holder) || !isIso(boundAt)) throw new CouponAdminError(changed);
  const releasedAt = now.toISOString();
  const { data, error } = await scopeToEnv(
    service
      .from('discount_coupons')
      .update({ released_at: releasedAt })
      .eq('bound_user_id', holder)
      .eq('bound_at', boundAt)
      .is('released_at', null),
    env
  ).select('code, batch');
  if (error) dbFail('귀속 해제', error, '해제하지 못했습니다.');
  const rows = (data ?? []) as { code: string; batch: string | null }[];
  if (rows.length !== 1) throw new CouponAdminError(changed);
  return { maskedCode: maskCouponCode(rows[0].code), batch: rows[0].batch, releasedAt };
}

/**
 * 등급 요율·상한 변경. updated_at(원문) CAS — 오래 열어 둔 탭이 다른 관리자의 브레이크(요율 인하)를 조용히 되돌리지 못하게.
 * 소급(applyToBound)은 자리를 차지한 귀속 전부(released_at is null — 회수·만료 포함: 되살리거나 연장했을 때 옛 조건이
 * 부활하지 않게). released 는 종료 상태라 건드리지 않는다. 소급은 멱등이다 — 실패하거나 소급과 동시에 귀속된 고객이 남으면
 * (화면 "옛 요율로 쓰는 귀속") 다시 실행하면 수렴한다.
 * ponytail: update·소급·감사는 한 트랜잭션이 아니다(가격 편집과 같은 한계) — 부분 실패는 결과에 담아 화면에 알린다.
 */
export async function updateCouponTier(
  service: SupabaseClient,
  input: TierInput & { applyToBound: boolean; seenUpdatedAt: string },
  actorId: string,
  now: Date = new Date()
): Promise<{ retroCount: number; retroFailed: boolean; auditFailed: boolean }> {
  const conflict = '다른 관리자가 먼저 바꿨어요. 새로고침한 뒤 다시 입력해 주세요.';
  if (!isIso(input.seenUpdatedAt)) throw new CouponAdminError(conflict);
  const { data: before, error: readError } = await service
    .from('coupon_tiers')
    .select('percent, max_discount_won')
    .eq('tier', input.tier)
    .maybeSingle();
  if (readError || !before) dbFail('등급 조회', readError, '등급을 읽지 못했습니다.');
  const nowIso = now.toISOString();
  const { data: updated, error } = await service
    .from('coupon_tiers')
    .update({ percent: input.percent, max_discount_won: input.maxDiscountWon, updated_at: nowIso, updated_by: actorId })
    .eq('tier', input.tier)
    .eq('updated_at', input.seenUpdatedAt)
    .select('tier');
  if (error) dbFail('등급 변경', error, '등급을 바꾸지 못했습니다.');
  if ((updated ?? []).length !== 1) throw new CouponAdminError(conflict);

  let retroCount = 0;
  let retroFailed = false;
  if (input.applyToBound) {
    const { count, error: retroError } = await service
      .from('discount_coupons')
      .update({ bound_percent: input.percent, bound_max_discount_won: input.maxDiscountWon }, { count: 'exact' })
      .eq('tier', input.tier)
      .not('bound_user_id', 'is', null)
      .is('released_at', null);
    if (retroError) console.error('[coupon-admin] 소급 실패', retroError.code);
    retroFailed = Boolean(retroError);
    retroCount = retroError ? 0 : (count ?? 0);
  }
  const prev = before as { percent: number; max_discount_won: number | null };
  const { error: auditError } = await service.from('coupon_tier_changes').insert({
    tier: input.tier,
    old_percent: prev.percent,
    new_percent: input.percent,
    old_max_discount_won: prev.max_discount_won,
    new_max_discount_won: input.maxDiscountWon,
    applied_to_bound: input.applyToBound && !retroFailed,
    changed_by: actorId,
    changed_at: nowIso,
  });
  if (auditError) console.error('[coupon-admin] 요율 감사 실패', auditError.code);
  return { retroCount, retroFailed, auditFailed: Boolean(auditError) };
}

/** 등급 끄기/켜기 — 전역 킬스위치(귀속자 포함 즉시). updated_at CAS. */
export async function setCouponTierDisabled(
  service: SupabaseClient,
  tier: CouponTier,
  disabled: boolean,
  seenUpdatedAt: string,
  actorId: string,
  now: Date = new Date()
): Promise<void> {
  const conflict = '다른 관리자가 먼저 바꿨어요. 새로고침한 뒤 다시 시도해 주세요.';
  if (!isIso(seenUpdatedAt)) throw new CouponAdminError(conflict);
  const nowIso = now.toISOString();
  const { data, error } = await service
    .from('coupon_tiers')
    .update({ disabled_at: disabled ? nowIso : null, updated_at: nowIso, updated_by: actorId })
    .eq('tier', tier)
    .eq('updated_at', seenUpdatedAt)
    .select('tier');
  if (error) dbFail('등급 on/off', error, '등급 상태를 바꾸지 못했습니다.');
  if ((data ?? []).length !== 1) throw new CouponAdminError(conflict);
}

/** 배치 코드 CSV(인쇄소 전달용). 🔴 호출부는 **감사 기록이 성공한 뒤에만** 결과를 클라이언트로 보낸다. */
export async function exportCouponBatch(
  service: SupabaseClient,
  batch: string,
  env: CouponEnv,
  now: Date = new Date()
): Promise<{ csv: string; fileName: string; rowCount: number; liveUnbound: number }> {
  assertBatchAllowed(batch, env, '내려받을');
  const rows = await fetchAllByKey<AdminCouponRow>(
    () => scopeToEnv(service.from('discount_coupons').select(ADMIN_COUPON_COLUMNS).eq('batch', batch), env) as unknown as KeysetQuery,
    'code',
    '내보내기 조회'
  );
  const states = rows.map((row) => ({ code: row.code, state: couponState(row, now), expires_at: row.expires_at }));
  return {
    csv: couponCsv(states),
    fileName: couponCsvFileName(batch, now),
    rowCount: rows.length,
    liveUnbound: states.filter((row) => row.state === 'unbound').length,
  };
}

/** 쿠폰 관리 감사 기록 — logAdminAccess 와 달리 insert 오류를 **던진다**(다운로드마다 감사 = 실패하면 멈춘다). */
export async function recordCouponAudit(service: SupabaseClient, input: AccessLogInput): Promise<void> {
  const { error } = await service.from('admin_access_log').insert(buildAccessLogInsert(input));
  if (error) dbFail('감사 기록', error, '감사 기록에 실패해 작업을 멈췄습니다.');
}

/**
 * 탈퇴 **전에** 그 계정이 차지한 쿠폰을 종료한다. payment_orders 는 탈퇴 시 cascade 로 지워져, 결제한 쿠폰도
 * "붙잡는 주문 없음"이 되어 24h 회수로 남에게 넘어간다(079 가 FK 를 빼서 막으려던 '탈퇴하면 코드 부활'의 우회로).
 * 실패해도 탈퇴는 막지 않는다(탈퇴는 이용자 권리) — 로그만 남긴다.
 */
export async function releaseCouponsOfUser(service: SupabaseClient, userId: string, now: Date = new Date()): Promise<boolean> {
  const { error } = await service
    .from('discount_coupons')
    .update({ released_at: now.toISOString() })
    .eq('bound_user_id', userId)
    .is('released_at', null);
  if (error) console.error('[coupon-admin] 탈퇴 전 쿠폰 종료 실패', error.code);
  return !error;
}
