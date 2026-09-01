// 2026-09-01 — 카카오 친구추가 쿠폰 검증 결과를 **사용자에게 보이는 말**로 옮긴다.
//
// 🔴 왜 생겼나: 콜백이 성공이든 실패든 `/my/settings?kakaoCoupon=...&reason=...` 로만
//   보냈는데 그 쿼리를 **아무도 읽지 않았다**. 성공해도 안내가 없고, 실패해도 같은
//   "받기" 버튼이 다시 보여 사용자는 같은 실패를 반복했다 — "쿠폰이 발송 안 된다"
//   컴플레인의 실체. 여기서 사유별로 **다음에 할 행동**까지 정해준다.
//
// 순수 함수 — 클라이언트 컴포넌트가 import 하므로 서버 의존성(Supabase 등) 금지.

export type CouponResultTone = 'success' | 'notice';
/** 사용자가 다음에 할 수 있는 것. add-channel = 채널 추가부터, retry = 확인 재시도. */
export type CouponResultAction = 'none' | 'add-channel' | 'retry';

export interface CouponVerifyResult {
  tone: CouponResultTone;
  title: string;
  body: string;
  action: CouponResultAction;
}

const RETRY_LABELS: Record<string, { title: string; body: string }> = {
  // 카카오 동의화면에서 사용자가 취소를 눌렀을 때 카카오가 주는 표준 오류.
  access_denied: {
    title: '카카오 동의가 취소됐어요',
    body: '채널 친구 확인에 동의해야 쿠폰을 드릴 수 있어요.',
  },
  unauthorized: {
    title: '로그인이 필요해요',
    body: '쿠폰은 계정에 저장돼요. 로그인하고 다시 받아주세요.',
  },
  issue_failed: {
    title: '쿠폰 저장에 실패했어요',
    body: '친구 확인은 끝났어요. 잠시 후 다시 눌러주시면 발급됩니다.',
  },
};

/**
 * `?kakaoCoupon=issued` / `?kakaoCoupon=error&reason=...` → 화면에 띄울 안내.
 * 해당 쿼리가 없으면 null(평소 화면 그대로).
 */
export function readCouponVerifyResult(search: string): CouponVerifyResult | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const outcome = params.get('kakaoCoupon');
  if (!outcome) return null;

  if (outcome === 'issued') {
    return {
      tone: 'success',
      title: '무료 쿠폰이 발급됐어요',
      body: '오늘 자세히보기에서 0원으로 사용하세요. 7일 안에 쓰시면 됩니다.',
      action: 'none',
    };
  }

  const reason = params.get('reason') ?? '';

  // 가장 흔한 실패 — 배너가 "친구추가하고 받기" 라고 말하지만 이 흐름은 **확인만** 한다.
  //   채널을 아직 추가하지 않은 사람은 여기로 떨어지므로, 추가 버튼을 같이 준다.
  if (reason === 'not_friend') {
    return {
      tone: 'notice',
      title: '아직 채널 친구가 아니에요',
      body: '카카오톡 채널을 먼저 추가한 뒤, 다시 확인을 눌러주세요.',
      action: 'add-channel',
    };
  }

  const known = RETRY_LABELS[reason];
  return {
    tone: 'notice',
    title: known?.title ?? '쿠폰 확인이 중간에 끊겼어요',
    body: known?.body ?? '잠시 후 다시 시도해 주세요. 계속 안 되면 문의해 주세요.',
    action: 'retry',
  };
}
