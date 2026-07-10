// 2026-07-10 — 결제 준비(prepare) 단계에서 나이스페이 키 짝을 검사한다.
//
// 배경: 2026-06-27 19:25~20:23 KST 에 승인 4건이 인가 실패했는데, 결제창은 멀쩡히 떴고
//   실패는 사용자가 카드정보를 다 입력한 **마지막 단계**에서 났다. 한 시간 동안 아무도 몰랐다.
//   키 짝이 깨졌으면 결제창을 띄우기 전에 크게 실패시키는 편이 낫다.
//
// ⚠️ 사유(detail)에는 문제 **코드**만 담는다. secretKey 값·길이 같은 건 응답에 넣지 않는다.
import type { NicepayKeyPairAudit } from '@/lib/payments/nicepay-config-audit';
import type { PaymentProvider } from '@/lib/payments/provider';

export interface NicepayPrepareBlock {
  reason: 'nicepay_key_pair_invalid';
  detail: string;
}

export function resolveNicepayPrepareBlock(
  provider: PaymentProvider,
  audit: NicepayKeyPairAudit
): NicepayPrepareBlock | null {
  if (provider !== 'nicepay') return null;
  if (audit.ok) return null;

  return {
    reason: 'nicepay_key_pair_invalid',
    detail: audit.problems.map((problem) => problem.code).join(', '),
  };
}
