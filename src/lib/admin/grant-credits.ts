// 2026-06-28 — 어드민 수동 코인 지급 입력 검증(순수). API/클라이언트가 공유.
//   코인 지급은 금전가치 부여라 super_admin 게이트 + 엄격 검증 + 감사 로그를 둔다.
//   실제 적립은 addCredits RPC(purchase=1년 만료 lot / subscription=무만료)가 수행.

export type GrantCreditType = 'purchase' | 'subscription';

export interface GrantCreditsInput {
  userId: string;
  amount: number;
  type: GrantCreditType;
  reason: string;
}

// 오타(0 하나 더)로 과지급되는 사고 방지용 상한. 그 이상은 분할 지급 또는 DB 직접.
export const MAX_GRANT_AMOUNT = 1000;
const MIN_REASON_LENGTH = 2;

export interface GrantCreditsValidation {
  ok: boolean;
  errors: string[];
  // 정규화된 값(ok=true 일 때만 신뢰).
  value: GrantCreditsInput | null;
}

export function validateGrantCredits(input: {
  userId?: unknown;
  amount?: unknown;
  type?: unknown;
  reason?: unknown;
}): GrantCreditsValidation {
  const errors: string[] = [];

  const userId = typeof input.userId === 'string' ? input.userId.trim() : '';
  if (!userId) errors.push('대상 사용자(userId)가 필요합니다.');

  const amount =
    typeof input.amount === 'number'
      ? input.amount
      : typeof input.amount === 'string' && input.amount.trim() !== ''
        ? Number(input.amount)
        : NaN;
  if (!Number.isInteger(amount)) {
    errors.push('지급 코인 수는 정수여야 합니다.');
  } else if (amount <= 0) {
    errors.push('지급 코인 수는 1 이상이어야 합니다.');
  } else if (amount > MAX_GRANT_AMOUNT) {
    errors.push(`지급 코인 수는 ${MAX_GRANT_AMOUNT} 이하여야 합니다(과지급 방지).`);
  }

  const type = input.type;
  if (type !== 'purchase' && type !== 'subscription') {
    errors.push("type 은 'purchase'(1년 만료) 또는 'subscription'(무만료)이어야 합니다.");
  }

  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (reason.length < MIN_REASON_LENGTH) {
    errors.push(`지급 사유를 ${MIN_REASON_LENGTH}자 이상 입력하세요(감사 추적).`);
  }

  if (errors.length > 0) {
    return { ok: false, errors, value: null };
  }

  return {
    ok: true,
    errors: [],
    value: { userId, amount, type: type as GrantCreditType, reason },
  };
}
