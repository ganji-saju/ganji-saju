import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeUserFacingCopy, simplifySajuCopy } from './public-copy';
import { MYEONGRI_GLOSSARY } from './terminology';

// 은유적 단독 "결" 탐지 패턴 (naming-policy §9).
//   - 합성어(연결/물결/한결/단결 등)는 "결" 앞 글자로 false positive 가 되므로
//     negative lookbehind 로 제외.
//   - 합성어(결과/결정/결제/결혼/결실/결단/결합/결국/결과물 등)는 "결" 뒤가
//     한글이므로 [^가-힣] 경계에 안 걸려 자동 제외.
//   - 단독 "결" 은 조사(이/가/을/…) 또는 경계(공백·문장부호·끝)로만 잡는다.
const STANDALONE_GYEOL =
  /(?<![연물한단일])결(?:(?:이|가|을|를|은|는|의|에|와|과|도|만|로|라|들)(?=[\s.,!?。、]|$|[^가-힣])|(?=[\s.,!?。、]|$|[^가-힣]))/u;

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

test('Fix A: 격국 전체 명칭이 "역할격" 으로 깨지지 않고 매끄러운 "…자리" 로 치환', () => {
  // '정관격' 이 '정관' 으로 부분 매치되어 '책임·도전 역할격' 으로 깨지던 과치환 회귀 차단.
  const cases: Array<[input: string, expectFragment: string]> = [
    ['정관격', '책임·도전 자리'],
    ['편관격', '책임·도전 자리'],
    ['정재격', '돈·기회 자리'],
    ['편재격', '돈·기회 자리'],
    ['식신격', '전달·재능 자리'],
    ['상관격', '전달·재능 자리'],
    ['정인격', '배움·휴식 자리'],
    ['편인격', '배움·휴식 자리'],
    ['비견격', '주체·자립 자리'],
    ['겁재격', '주체·자립 자리'],
  ];
  for (const [input, expectFragment] of cases) {
    const output = simplifySajuCopy(input) ?? '';
    assert.ok(
      !output.includes('역할격'),
      `"${input}" → "${output}" 에 깨진 "역할격" 이 남으면 안 됨`
    );
    assert.equal(output, expectFragment, `"${input}" → "${expectFragment}"`);
  }
});

test('Fix A: 단독 십성(정관/식신 등)은 기존 "…역할" 치환을 유지', () => {
  assert.equal(simplifySajuCopy('정관'), '책임·도전 역할');
  assert.equal(simplifySajuCopy('식신'), '전달·재능 역할');
});

test('Fix D: MYEONGRI_GLOSSARY 의 모든 plainCue 에 은유적 단독 "결" 이 없다', () => {
  for (const [term, entry] of Object.entries(MYEONGRI_GLOSSARY)) {
    assert.ok(
      !STANDALONE_GYEOL.test(entry.plainCue),
      `glossary "${term}" plainCue 에 단독 "결" 잔존: "${entry.plainCue}"`
    );
  }
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

// 2026-05-23: 치환 후 받침 기준 조사 자동정정 (Fix 1) 회귀 가드.
//   FRIENDLY_TERM_MAP/TERM_REPLACEMENTS 가 한자 술어(받침O)를 모음·ㄹ 종결 일상어로
//   바꾼 뒤 조사가 어긋나던 class a 버그를 normalizeParticles 가 교정한다.

test('Fix 1: 치환 결과가 모음 종결이면 으로→로 정정 (선택 기준으로 → 선택 힌트로)', () => {
  assert.ok(simplifySajuCopy('선택 기준으로').includes('선택 힌트로'));
  assert.ok(!simplifySajuCopy('선택 기준으로').includes('힌트으로'));
  assert.ok(simplifySajuCopy('판단 기준으로').includes('판단 힌트로'));
});

test('Fix 1: ㄹ 종결(역할)은 으로→로 (관계 역할으로 → 관계 역할로)', () => {
  const out = simplifySajuCopy('丑 월지를 관계 역할으로 환산');
  assert.ok(out.includes('관계 역할로'), `출력: "${out}"`);
  assert.ok(!out.includes('역할으로'), `출력: "${out}"`);
});

test('Fix 1: 모음 종결 단어 뒤 주격/목적격 조사 정정 (신호은/자리은/사주을 등)', () => {
  const cases: Array<[input: string, expectFragment: string, banned: string]> = [
    ['합충은 명식 안에서 묶입니다.', '만남과 변화 신호는', '신호은'],
    ['공망은 비어 보입니다.', '비어있는 자리는', '자리은'],
    ['신살은 도움을 줍니다.', '작은 신호는', '신호은'],
    ['타고난 사주을 봅니다.', '타고난 사주를', '사주을'],
    ['명식이 안내해요.', '내 사주표가', '사주표이'],
    ['긴 흐름이 비어요.', '긴 흐름이', '흐름가'], // 흐름(받침ㅁ) → 이 유지
  ];
  for (const [input, expectFragment, banned] of cases) {
    const output = simplifySajuCopy(input) ?? '';
    assert.ok(output.includes(expectFragment), `"${input}" → "${output}" 에 "${expectFragment}" 기대`);
    assert.ok(!output.includes(banned), `"${input}" → "${output}" 에 "${banned}" 잔존 금지`);
  }
});

test('Fix 1: 서술격 조사(이다/이라/이란/입니다/이고)는 절대 변형하지 않음', () => {
  // '이' 가 주격이 아니라 서술격(copula)일 때는 받침 정정 대상이 아님.
  assert.equal(simplifySajuCopy('이것은 식신격이다.'), '이것은 전달·재능 자리이다.');
  assert.equal(simplifySajuCopy('정관격입니다.'), '책임·도전 자리입니다.');
  assert.equal(simplifySajuCopy('내 사주표입니다.'), '내 사주표입니다.');
  assert.equal(simplifySajuCopy('관계 역할이라는 틀'), '관계 역할이라는 틀');
  const out = simplifySajuCopy('내 사주표이라 과열되기 쉽습니다.');
  assert.ok(out.includes('내 사주표이라'), `copula 보존 실패 — "${out}"`);
});

test('Fix 1: 인접 단어 중복 제거 (대운 흐름→긴 흐름, 오늘 일진→오늘 하루 흐름)', () => {
  assert.equal(simplifySajuCopy('대운 흐름'), '긴 흐름');
  assert.ok(!simplifySajuCopy('긴 흐름 흐름').includes('흐름 흐름'));
  assert.ok(!simplifySajuCopy('오늘 일진 갑자').includes('오늘 오늘'));
  // 조사가 붙은 중복도 정정 (임자 일주 title + ' 흐름이' 템플릿).
  assert.equal(
    simplifySajuCopy('큰 물이 큰 물을 만난 흐름 흐름이 기본 바탕입니다.'),
    '큰 물이 큰 물을 만난 흐름이 기본 바탕입니다.'
  );
});

test('sanitizeUserFacingCopy: 사용자 풀이에서 표현/기준 계열 단어 제거', () => {
  const output = sanitizeUserFacingCopy(
    '표현을 챙기면 하루가 안정됩니다. 선택 기준으로 보면 표현이 부족합니다.'
  );

  assert.equal(
    output,
    '말을 챙기면 하루가 안정됩니다. 선택 힌트로 보면 말이 부족합니다.'
  );
  assert.doesNotMatch(output, /표현|기준/);
});

test('Fix 1: 일반 강조 반복(점점/차근차근)은 보존 — 화이트리스트 단어만 dedupe', () => {
  assert.equal(simplifySajuCopy('점점 점점 좋아진다'), '점점 점점 좋아진다');
});
