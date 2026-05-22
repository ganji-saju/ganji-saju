import assert from 'node:assert/strict';
import { validateDaewoonText } from './daewoon-validator';

declare const test: (name: string, fn: () => void) => void;

test('daewoon-validator: 한자(60갑자) 검출', () => {
  const r = validateDaewoonText('戊辰 대운은 토 기운이 강합니다');
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some((x) => x.includes('한자')));
});

test('daewoon-validator: 명리 전문용어 검출 (천간/지지/교운기/일간)', () => {
  assert.equal(validateDaewoonText('천간의 토가 들어와요').ok, false);
  assert.equal(validateDaewoonText('지지의 토 결이 작동').ok, false);
  assert.equal(validateDaewoonText('지금은 교운기 진입입니다').ok, false);
  assert.equal(validateDaewoonText('무 일간의 반응 방식').ok, false);
});

test('daewoon-validator: 동사어미 "지지" false positive 회피', () => {
  // '강해지지만' / '흩어지지 않다' 의 "지지" 는 명리 용어가 아님 → 통과
  assert.equal(validateDaewoonText('자신감이 강해지지만 과속을 경계하세요').ok, true);
  assert.equal(validateDaewoonText('인연이 흩어지지 않도록 챙기세요').ok, true);
  assert.equal(validateDaewoonText('책임지지 않는 일도 늘리기').ok, true);
});

test('daewoon-validator: 허용 어휘(대운 / 12운성 한글)는 통과', () => {
  assert.equal(validateDaewoonText('무진 대운은 장생의 결로 흘러갑니다').ok, true);
  assert.equal(validateDaewoonText('이 10년은 토 기운과 금 기운이 함께 들어오는 결입니다').ok, true);
});
