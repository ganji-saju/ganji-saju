import assert from 'node:assert/strict';
import { nicepayFailMessage } from './nicepay-fail-message';

declare const test: (name: string, fn: () => void) => void;

test('nicepayFailMessage: 실측 사유별 안내(인증 취소·탈회카드)와 기본 문구', () => {
  assert.match(nicepayFailMessage('auth', '9991', '인증이 취소 되었거나 실패하였습니다.(결제를 취소하였습니다.)'), /인증이 취소됐어요/);
  assert.match(nicepayFailMessage('approve', 'EP07', '제휴사 거래상태 조회 실패(카드 인증정보 조회를 실패하였습니다. (4005 - (N019)탈회카드 입니다.'), /사용할 수 없는 카드/);
  assert.match(nicepayFailMessage('approve', 'X', '한도초과'), /한도나 잔액/);
  assert.equal(nicepayFailMessage('approve', null, null), '결제 승인에 실패했어요. 다른 카드로 다시 시도해 주세요.');
  // 실패 화면(/credits/fail)이 '결제 금액은 청구되지 않았습니다.'를 덧붙이므로 문구에 같은 말을 넣지 않는다.
  assert.doesNotMatch(nicepayFailMessage('auth', '9991', '취소'), /청구|진행되지/);
});
