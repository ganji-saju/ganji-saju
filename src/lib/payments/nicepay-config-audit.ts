// 2026-07-10 — 나이스페이 키 짝(pair) 감사.
//
// 왜 필요한가: nicepay-env.getNicepayClientKey() 와 nicepay.getSecretKey() 는 모드별 키가 없으면
//   각각 **독립적으로** 공용 키로 폴백한다. 그래서 'live clientKey + 공용(샌드박스) secretKey' 처럼
//   서로 다른 가맹점의 키가 조용히 짝지어질 수 있다. 나이스페이는 이 조합의 Basic 인가를
//   "사용자 정보가 존재하지 않습니다." 로 거절한다(2026-06-27 승인 실패 4건의 resultMsg).
//
// 이 모듈은 값을 노출하지 않고 **출처와 정합성만** 보고한다. secretKey 원문은 절대 반환하지 않는다.
import { getNicepayMode, type NicepayMode } from '@/lib/payments/nicepay-env';

export type KeySource = 'mode' | 'fallback' | 'missing';

export interface NicepayKeyPairProblem {
  code:
    | 'key_source_mismatch'
    | 'client_key_prefix_mismatch'
    | 'api_base_mode_mismatch'
    | 'client_key_missing'
    | 'secret_key_missing';
  detail: string;
}

export interface NicepayKeyPairAudit {
  mode: NicepayMode;
  apiBase: string;
  apiBaseExplicit: boolean;
  clientKeySource: KeySource;
  /** 공개값(NEXT_PUBLIC)이라 접두사 노출 안전. 모드 판별에 필요. */
  clientKeyPrefix: string | null;
  secretKeySource: KeySource;
  /** 값은 절대 노출하지 않는다. 존재/길이만. */
  secretKeyLength: number;
  ok: boolean;
  problems: NicepayKeyPairProblem[];
}

/** 나이스페이 clientKey 접두사 규약. ⚠️ 검증필요: 콘솔 발급 키로 최종 확인할 것. */
const MODE_BY_CLIENT_KEY_PREFIX: Record<string, NicepayMode> = {
  R2_: 'live',
  S2_: 'sandbox',
};

function resolve(modeValue: string | undefined, fallbackValue: string | undefined) {
  const mode = modeValue?.trim();
  if (mode) return { value: mode, source: 'mode' as const };
  const fallback = fallbackValue?.trim();
  if (fallback) return { value: fallback, source: 'fallback' as const };
  return { value: '', source: 'missing' as const };
}

export function auditNicepayKeyPair(): NicepayKeyPairAudit {
  const mode = getNicepayMode();

  const client = resolve(
    mode === 'sandbox'
      ? process.env.NEXT_PUBLIC_NICEPAY_SANDBOX_CLIENT_KEY
      : process.env.NEXT_PUBLIC_NICEPAY_LIVE_CLIENT_KEY,
    process.env.NEXT_PUBLIC_NICEPAY_CLIENT_KEY
  );
  const secret = resolve(
    mode === 'sandbox'
      ? process.env.NICEPAY_SANDBOX_SECRET_KEY
      : process.env.NICEPAY_LIVE_SECRET_KEY,
    process.env.NICEPAY_SECRET_KEY
  );

  const explicitBase = process.env.NICEPAY_API_BASE?.trim().replace(/\/$/, '');
  const apiBase =
    explicitBase ||
    (mode === 'sandbox' ? 'https://sandbox-api.nicepay.co.kr' : 'https://api.nicepay.co.kr');

  const problems: NicepayKeyPairProblem[] = [];

  if (client.source === 'missing') {
    problems.push({ code: 'client_key_missing', detail: 'clientKey 를 찾지 못했습니다.' });
  }
  if (secret.source === 'missing') {
    problems.push({ code: 'secret_key_missing', detail: 'secretKey 를 찾지 못했습니다.' });
  }

  // 한쪽만 모드별 키면 서로 다른 가맹점 키가 섞였을 수 있다 — 이번 장애의 구조적 원인.
  if (
    client.source !== 'missing' &&
    secret.source !== 'missing' &&
    client.source !== secret.source
  ) {
    problems.push({
      code: 'key_source_mismatch',
      detail: `clientKey 는 ${client.source}, secretKey 는 ${secret.source} 에서 왔습니다. 같은 가맹점 키가 아닐 수 있습니다.`,
    });
  }

  const prefix = client.value ? client.value.slice(0, 3) : null;
  const prefixMode = prefix ? MODE_BY_CLIENT_KEY_PREFIX[prefix] : undefined;
  if (prefixMode && prefixMode !== mode) {
    problems.push({
      code: 'client_key_prefix_mismatch',
      detail: `모드는 ${mode} 인데 clientKey 접두사 ${prefix} 는 ${prefixMode} 키입니다.`,
    });
  }

  if (explicitBase) {
    const baseIsSandbox = explicitBase.includes('sandbox-api.nicepay');
    const baseMode: NicepayMode = baseIsSandbox ? 'sandbox' : 'live';
    if (baseMode !== mode) {
      problems.push({
        code: 'api_base_mode_mismatch',
        detail: `NICEPAY_API_BASE 가 ${baseMode} 호스트를 가리키는데 모드는 ${mode} 입니다. 명시 호스트가 모드를 덮어씁니다.`,
      });
    }
  }

  return {
    mode,
    apiBase,
    apiBaseExplicit: Boolean(explicitBase),
    clientKeySource: client.source,
    clientKeyPrefix: prefix,
    secretKeySource: secret.source,
    secretKeyLength: secret.value.length,
    ok: problems.length === 0,
    problems,
  };
}
