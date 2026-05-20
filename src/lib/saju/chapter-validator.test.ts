import test from 'node:test';
import assert from 'node:assert/strict';
import { validateChapterBody } from './chapter-validator';

// 2026-05-19 — chapter-validator 6 룰 단위 검증.

test('clean body 는 passed=true, failures 빈 배열', () => {
  const body =
    '선생님의 사주는 흙의 결을 중심으로 정인의 결이 또렷이 흐릅니다. 가까운 사람을 챙기는 패턴이 반복돼요.';
  const result = validateChapterBody(body);
  assert.equal(result.passed, true, `failures: ${JSON.stringify(result.failures)}`);
  assert.equal(result.failures.length, 0);
});

test('한자 노출 시 hanja rule fail', () => {
  const result = validateChapterBody('丙申 대운에는 결단력이 강해집니다.');
  assert.equal(result.passed, false);
  const hanjaFailure = result.failures.find((f) => f.rule === 'hanja');
  assert.ok(hanjaFailure, 'hanja rule failure 존재');
});

test('옛 "X과/와 Y" 라벨 5종 모두 검출', () => {
  const oldLabels = ['시작과 추진', '열정과 표현', '안정과 중심', '결단과 마무리', '지혜와 유연'];
  for (const label of oldLabels) {
    const result = validateChapterBody(`${label} 결이 강한 시기입니다.`);
    assert.equal(result.passed, false, `옛 라벨 '${label}' 가 통과되면 안 됨`);
    assert.ok(
      result.failures.some((f) => f.rule === 'x-과-label' && f.excerpt === label),
      `'${label}' 가 x-과-label rule 로 잡혀야 함`
    );
  }
});

test('새 자연 비유 라벨 (새싹/햇살/흙/쇠/물 의 결) 은 통과', () => {
  const newLabels = ['새싹의 결', '햇살의 결', '흙의 결', '쇠의 결', '물의 결'];
  for (const label of newLabels) {
    const result = validateChapterBody(`${label}이 강한 시기입니다.`);
    assert.equal(result.passed, true, `새 라벨 '${label}' 가 통과되어야 함`);
  }
});

test('영어 단어 노출 시 english rule fail', () => {
  const result = validateChapterBody('명분과 timing을 같이 봅니다.');
  assert.equal(result.passed, false);
  const englishFailure = result.failures.find((f) => f.rule === 'english');
  assert.ok(englishFailure, 'english rule failure 존재');
  assert.ok(englishFailure?.excerpt?.includes('timing'));
});

test('단정·자극 표현 7개 모두 검출', () => {
  const forbidden = ['반드시', '절대', '대흉', '암흑기', '텅장', '비책', '운명을 내 편'];
  for (const phrase of forbidden) {
    const result = validateChapterBody(`이 시기는 ${phrase} 주의가 필요합니다.`);
    const failure = result.failures.find((f) => f.rule === 'absolute' && f.excerpt === phrase);
    assert.ok(failure, `'${phrase}' 가 absolute rule 로 잡혀야 함`);
  }
});

test('cross-chapter 중복 — 두 챕터 첫 문장이 일치하면 fail', () => {
  const chapter1 = '돌봄과 배움이 본질입니다. 그 다음은 세부입니다.';
  const chapter2 = '돌봄과 배움이 본질입니다. 다만 표현이 약합니다.';
  const result = validateChapterBody(chapter2, {
    chapterId: 2,
    allChapters: [chapter1, chapter2],
  });
  const failure = result.failures.find((f) => f.rule === 'cross-chapter');
  assert.ok(failure, '두 챕터 첫 문장 일치 시 cross-chapter rule fail');
});

test('cross-chapter — 첫 문장이 다르면 통과', () => {
  const chapter1 = '돌봄과 배움이 본질입니다. 다음 문장은 다릅니다.';
  const chapter2 = '관계는 챙기는 자리가 자연스럽게 옵니다. 본인 마음 챙김도 필요해요.';
  const result = validateChapterBody(chapter2, {
    chapterId: 2,
    allChapters: [chapter1, chapter2],
  });
  assert.equal(result.passed, true);
});

test('punch-copy 중복 — 같은 한 줄이 2 챕터 이상 등장하면 fail', () => {
  const punch = '배움과 도움을 크게 쓰는 편';
  const chapter1 = `선생님은 ${punch}이라 부드럽게 흐릅니다.`;
  const chapter2 = `관계 결도 ${punch}으로 풀려요.`;
  const result = validateChapterBody(chapter2, {
    chapterId: 2,
    allChapters: [chapter1, chapter2],
    punchLines: [punch],
  });
  const failure = result.failures.find((f) => f.rule === 'punch-copy-duplication');
  assert.ok(failure, 'punch-copy 가 2 챕터에 등장 시 fail');
});

test('punch-copy — 본인 챕터에만 1번 등장하면 통과', () => {
  const punch = '배움과 도움을 크게 쓰는 편';
  const chapter1 = `선생님은 ${punch}이라 부드럽게 흐릅니다.`;
  const chapter2 = '관계 결은 또 다른 결로 풉니다.';
  const result = validateChapterBody(chapter1, {
    chapterId: 1,
    allChapters: [chapter1, chapter2],
    punchLines: [punch],
  });
  assert.equal(result.passed, true);
});

test('option 없이 사용 시 cross-chapter / punch-copy 룰 skip', () => {
  const result = validateChapterBody('정상 한국어 본문입니다.');
  assert.equal(result.passed, true);
  assert.equal(result.failures.length, 0);
});

test('한 본문에 여러 룰 동시 violation — 모두 수집', () => {
  const body = '丙申 대운에는 결단과 마무리 결이 timing 에 반드시 강해집니다.';
  const result = validateChapterBody(body);
  assert.equal(result.passed, false);
  const ruleSet = new Set(result.failures.map((f) => f.rule));
  assert.ok(ruleSet.has('hanja'), 'hanja rule 포함');
  assert.ok(ruleSet.has('x-과-label'), 'x-과-label rule 포함');
  assert.ok(ruleSet.has('english'), 'english rule 포함');
  assert.ok(ruleSet.has('absolute'), 'absolute rule 포함');
});

// 2026-05-20 V2-5 PR M — 신규 룰 3종 단위 검증.

test('"결" 빈도 초과 시 gyeol-frequency rule fail', () => {
  // 6번 등장 (한도 5) — 단어 경계 매칭이 잡도록 자연 한국어 문맥
  const body =
    '흙의 결이 강한 사주예요. 쇠의 결이 부족해요. 물의 결을 보강하세요. 새싹의 결이 자라요. 햇살의 결을 살리세요. 흙의 결로 다시 돌아옵니다.';
  const result = validateChapterBody(body);
  const gyeolFail = result.failures.find((f) => f.rule === 'gyeol-frequency');
  assert.ok(gyeolFail, '"결" 6회 등장이 fail 로 잡혀야 함');
});

test('"결" 빈도 5회 이내는 통과', () => {
  const body =
    '흙의 결이 강한 사주예요. 쇠의 결이 부족해요. 물의 결을 보강하세요. 새싹의 결이 자라요. 햇살의 결을 살리세요.';
  const result = validateChapterBody(body);
  assert.ok(
    !result.failures.find((f) => f.rule === 'gyeol-frequency'),
    '"결" 5회는 통과'
  );
});

test('"결단/결과/결정" 같은 복합어는 "결" 빈도 카운트에 포함 안 됨', () => {
  // 복합어 ("결단력", "결정", "결과") 7회 — 단독 "결" 0회
  const body =
    '결단력이 좋아요. 결정에 신중해요. 결과를 봐요. 결단을 내려요. 결정적 순간이 옵니다. 결과적으로 좋아요. 결단의 시기입니다.';
  const result = validateChapterBody(body);
  assert.ok(
    !result.failures.find((f) => f.rule === 'gyeol-frequency'),
    '복합어는 카운트 X'
  );
});

test('한 문장 65자 초과 시 sentence-length rule fail', () => {
  // 80자짜리 한 문장
  const body =
    '이 사주는 흙의 결이 강하고 쇠의 결이 부족해서 결단을 내리는 자리에서 마음이 흔들리기 쉬운데 그럴 때마다 잠시 멈춰 호흡을 다듬는 것이 중요합니다.';
  const result = validateChapterBody(body);
  const lenFail = result.failures.find((f) => f.rule === 'sentence-length');
  assert.ok(lenFail, '긴 문장이 fail 로 잡혀야 함');
});

test('짧은 문장들은 sentence-length 통과', () => {
  const body =
    '이 사주는 흙의 결이 강해요. 쇠의 결을 보강하세요. 작은 루틴이 도움돼요.';
  const result = validateChapterBody(body);
  assert.ok(
    !result.failures.find((f) => f.rule === 'sentence-length'),
    '짧은 문장 통과'
  );
});

test('막연한 위로 표현 시 vague-comfort rule fail', () => {
  const body = '걱정 마세요. 잘 될 거예요.';
  const result = validateChapterBody(body);
  const comfortFail = result.failures.find((f) => f.rule === 'vague-comfort');
  assert.ok(comfortFail, '막연한 위로가 fail 로 잡혀야 함');
});

test('데이터 근거 있는 위로 표현은 통과', () => {
  // "괜찮을 거예요" 가 없는 자연스러운 위로 — 결·신호·시점 정보 동반
  const body =
    '이 흐름이 안정되면 마음이 가벼워져요. 작은 루틴 하나가 회복 축이 됩니다.';
  const result = validateChapterBody(body);
  assert.ok(
    !result.failures.find((f) => f.rule === 'vague-comfort'),
    '근거 있는 위로 통과'
  );
});

test('skipRules — 특정 룰만 비활성화 가능', () => {
  // sentence-length 룰 위반 본문이지만 skipRules 로 스킵
  const longBody =
    '이 사주는 흙의 결이 강하고 쇠의 결이 부족해서 결단을 내리는 자리에서 마음이 흔들리기 쉬운데 그럴 때마다 잠시 멈춰 호흡을 다듬는 것이 중요합니다.';
  const skipped = validateChapterBody(longBody, { skipRules: ['sentence-length'] });
  assert.ok(
    !skipped.failures.find((f) => f.rule === 'sentence-length'),
    'sentence-length skip 시 미적용'
  );
});
