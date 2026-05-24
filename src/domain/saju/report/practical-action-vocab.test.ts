import assert from 'node:assert/strict';
import { SHORTAGE_ACTION_DICT, EXCESS_ACTION_DICT } from '@/domain/saju/report/build-lifetime-report';

declare const test: (name: string, fn: () => void) => void;

const CJK = /[㐀-鿿]/;
// naming-policy §2 절대금지: 자연 명사(새싹/햇살/흙/쇠/물/나무/불/땅)를 오행 라벨로 단독 사용
const METAPHOR_KI = /(새싹|햇살|흙|쇠|물|나무|불|땅)\s*기운/;

test('SHORTAGE/EXCESS 오행 사전: reason이 "X 기운" 표준 + 메타포/한자/기운중복 없음 (naming-policy §2)', () => {
  for (const [name, dict] of [
    ['SHORTAGE', SHORTAGE_ACTION_DICT],
    ['EXCESS', EXCESS_ACTION_DICT],
  ] as const) {
    for (const [el, action] of Object.entries(dict)) {
      const r = action.reason;
      assert.ok(!CJK.test(r), `${name}.${el} reason 한자 잔존: "${r}"`);
      assert.doesNotMatch(r, METAPHOR_KI, `${name}.${el} reason 메타포 오행어: "${r}"`);
      assert.ok(r.includes(`${el} 기운`), `${name}.${el} reason에 표준 "${el} 기운" 없음: "${r}"`);
      assert.equal(
        (r.match(/기운/g) || []).length,
        1,
        `${name}.${el} reason "기운" 중복: "${r}"`
      );
    }
  }
});
