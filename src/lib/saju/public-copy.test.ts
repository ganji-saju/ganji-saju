import test from 'node:test';
import assert from 'node:assert/strict';
import { simplifySajuCopy } from './public-copy';

// 2026-05-19 P0 bugfix invariant — terminology.ts 의 FRIENDLY_TERM_MAP regex 회귀 차단.
//   B01: '내 사주표' 안의 '사주표' 가 다시 매치되어 '내 내 사주표' 누적
//   B05: '커지지만' 안의 '지지' 가 명리 술어로 매치되어 '커안쪽 자리만'

test('B01 fix: 이미 "내 사주표" 가 들어간 텍스트는 재치환되지 않음', () => {
  const input = '생활 전체의 템포가 어긋나기 쉬운 내 사주표입니다.';
  const output = simplifySajuCopy(input) ?? '';
  assert.equal(output, input, '"내 " 가 앞에 있으면 사주표 regex 가 매치 안 해야 함');
  assert.ok(!output.includes('내 내'), '"내 내" 같은 누적 치환 0건');
});

test('B01 정상 동작: 단독 "사주표" 는 "내 사주표" 로 치환', () => {
  const output = simplifySajuCopy('사주표가 안내해줍니다.') ?? '';
  assert.equal(output, '내 사주표가 안내해줍니다.');
});

test('B01 정상 동작: "명식" 도 "내 사주표" 로 치환되고, 그 결과가 재치환되지 않음', () => {
  const output = simplifySajuCopy('명식 안내') ?? '';
  assert.equal(output, '내 사주표 안내', '명식 → 내 사주표 (1회) 만 적용');
});

test('B05 fix: 일반 동사 "커지지만" 안의 "지지" 부분 매치 차단', () => {
  const input = '바꾸고 싶은 마음이 커지지만 시험 운전이 먼저인 달입니다.';
  const output = simplifySajuCopy(input) ?? '';
  assert.equal(output, input, '한국어 동사 -지지- 는 명리 술어 "지지" 와 다름');
  assert.ok(!output.includes('커안쪽 자리'), '"커안쪽 자리만" 같은 깨짐 0건');
});

test('B05 정상 동작: 명리 술어 "지지" 는 여전히 "안쪽 자리" 로 치환', () => {
  // 앞뒤에 한글이 없는 boundary 상황 (공백/문장부호)
  const output = simplifySajuCopy('천간과 지지의 결을 함께 봅니다.') ?? '';
  assert.ok(
    output.includes('안쪽 자리'),
    `정상 명리 술어 매치 — 출력: "${output}"`
  );
});

test('B05 정상 동작: "지지단" 은 변경 안 됨 (기존 negative lookahead 유지)', () => {
  const output = simplifySajuCopy('지지단 정보') ?? '';
  assert.equal(output, '지지단 정보');
});

test('terminology FRIENDLY_TERM_MAP 의 모든 regex 가 동음 한국어 단어를 깨뜨리지 않는지 — 회귀 가드', () => {
  // 일반 한국어 단어에 들어가지 말아야 할 명리 술어 매치 검증.
  // 깨지면 다른 regex 도 같은 종류의 word-boundary 누락이 있다는 신호.
  const dangerInputs = [
    '커지지만 작은 변화부터',         // B05 — 지지
    '내 사주표를 다시 봅니다',          // B01 — 사주표
  ];
  for (const input of dangerInputs) {
    const output = simplifySajuCopy(input) ?? '';
    assert.equal(
      output,
      input,
      `명리 술어와 무관한 일반 단어가 변경됨 — input="${input}" output="${output}"`
    );
  }
});
