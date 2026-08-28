// 2026-08-29 — 결제가 **어느 환경에서 일어났는지** 주문에 남긴다.
//
//   staging 과 프로덕션이 **같은 Supabase 프로젝트**를 쓴다. 그래서 스테이징에서 테스트로
//   결제하면 그 주문이 프로덕션 매출/LTV 와 같은 표에 그대로 섞인다 — 관리자에서 보면
//   실결제와 구별할 방법이 없었다(사용자 제보: "매출에 반영되니 헷갈려 죽겠어").
//
//   판정 근거는 **요청 호스트**다. PG 모드(sandbox/live)나 env 플래그가 아니라 호스트를
//   쓰는 이유: env 는 배포 설정이 바뀌면 과거 주문의 해석까지 바뀌지만, 호스트는 그
//   결제가 실제로 일어난 자리라 시간이 지나도 뜻이 변하지 않는다.

export type PaymentOriginEnv = 'production' | 'staging' | 'preview' | 'local' | 'unknown';

export interface PaymentOrigin {
  env: PaymentOriginEnv;
  host: string | null;
}

const PRODUCTION_HOSTS = new Set(['ganjisaju.kr', 'www.ganjisaju.kr']);
const STAGING_HOSTS = new Set(['staging.ganjisaju.kr']);
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

/** 호스트 문자열(포트 포함 가능) → 환경. */
export function resolvePaymentOriginEnv(host: string | null | undefined): PaymentOriginEnv {
  const normalized = String(host ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]!
    .split(':')[0]!;
  if (!normalized) return 'unknown';
  if (PRODUCTION_HOSTS.has(normalized)) return 'production';
  if (STAGING_HOSTS.has(normalized)) return 'staging';
  if (LOCAL_HOSTS.has(normalized)) return 'local';
  // *.vercel.app 은 프리뷰 배포. 프로덕션 도메인이 아니므로 실매출로 보지 않는다.
  if (normalized.endsWith('.vercel.app')) return 'preview';
  return 'unknown';
}

/** 주문 metadata 에 넣을 값. host 를 함께 남겨 나중에 규칙이 바뀌어도 재판정할 수 있다. */
export function buildPaymentOrigin(host: string | null | undefined): PaymentOrigin {
  const normalized = String(host ?? '').trim().toLowerCase() || null;
  return { env: resolvePaymentOriginEnv(normalized), host: normalized };
}

/**
 * 주문 metadata 에서 출처를 읽는다.
 *
 * ⚠️ 이 필드가 생기기 **전에 만들어진 주문은 전부 'unknown'** 이다 — 과거를 소급해
 * 알아낼 방법이 없다(호스트를 어디에도 안 남겼다). 화면에서 'unknown' 을 실결제로
 * 뭉뚱그리면 안 되고, '기록 없음'으로 따로 보여야 한다.
 */
export function readPaymentOrigin(metadata: unknown): PaymentOrigin {
  if (!metadata || typeof metadata !== 'object') return { env: 'unknown', host: null };
  const origin = (metadata as Record<string, unknown>).origin;
  if (!origin || typeof origin !== 'object') return { env: 'unknown', host: null };
  const record = origin as Record<string, unknown>;
  const host = typeof record.host === 'string' ? record.host : null;
  const env = typeof record.env === 'string' ? record.env : null;
  const known: PaymentOriginEnv[] = ['production', 'staging', 'preview', 'local', 'unknown'];
  return {
    env: known.includes(env as PaymentOriginEnv) ? (env as PaymentOriginEnv) : resolvePaymentOriginEnv(host),
    host,
  };
}

/** 실매출로 셀 수 있는가. 기록이 없는 과거 주문(unknown)은 **제외하지 않는다** — 그때는
 *  스테이징 결제 경로가 있었는지조차 알 수 없어, 빼면 과거 매출이 근거 없이 줄어든다. */
export function isRealRevenueOrigin(env: PaymentOriginEnv): boolean {
  return env === 'production' || env === 'unknown';
}

const LABELS: Record<PaymentOriginEnv, string> = {
  production: '실결제',
  staging: '스테이징',
  preview: '프리뷰',
  local: '로컬',
  unknown: '출처 미기록',
};

export function paymentOriginLabel(env: PaymentOriginEnv): string {
  return LABELS[env];
}

/**
 * 2026-08-29 — 매출 집계에 넣을 주문인가.
 *
 * ⚠️ **DB 쿼리로 거르지 마라.** `metadata->origin->>env` 는 이 필드가 생기기 전 주문에서
 * NULL 이고, `not in (...)` 은 NULL 을 만나면 행을 통째로 떨어뜨린다 — 과거 매출이
 * 조용히 사라진다. JS 에서 걸러야 'unknown' 을 **매출로 남길** 수 있다.
 */
export function isRealRevenueOrder(row: { metadata?: unknown } | null | undefined): boolean {
  return isRealRevenueOrigin(readPaymentOrigin(row?.metadata).env);
}
