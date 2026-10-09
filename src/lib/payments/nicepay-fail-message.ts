// 2026-10-08 — 결제 실패 안내를 손님이 다음 행동을 고를 수 있게(사용자 요청). 결제사 원문은 서버 로그·퍼널에만 남기고
//   화면엔 원인별 쉬운 말만 보인다. 실측: 같은 손님이 인증 취소(9991) 2회·탈회카드(N019) 1회 실패 뒤 다른 카드로 성공.
export function nicepayFailMessage(stage: 'auth' | 'approve', code: string | null | undefined, msg: string | null | undefined): string {
  const text = `${code ?? ''} ${msg ?? ''}`;
  if (/탈회|N019|분실|도난|정지|해지|유효기간/.test(text)) return '사용할 수 없는 카드예요. 다른 카드로 결제해 주세요.';
  if (/한도|잔액/.test(text)) return '카드 한도나 잔액이 부족해요. 다른 카드로 결제해 주세요.';
  if (stage === 'auth' && (/9991|취소/.test(text))) return '결제 인증이 취소됐어요. 다시 시도해 주세요.';
  if (/비밀번호|인증번호|본인인증/.test(text)) return '카드 인증 정보가 맞지 않아요. 확인 후 다시 시도해 주세요.';
  return stage === 'auth'
    ? '결제 인증을 마치지 못했어요. 다시 시도해 주세요.'
    : '결제 승인에 실패했어요. 다른 카드로 다시 시도해 주세요.';
}
