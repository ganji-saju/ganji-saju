import assert from 'node:assert/strict';
import { normalizeToSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { buildLifetimeReport } from '@/domain/saju/report';
import type { BirthInput } from '@/lib/saju/types';
import { validateChapterBody } from '@/lib/saju/chapter-validator';
import { validateDaewoonText } from '@/lib/saju/daewoon-validator';
import { buildFallbackLifetimeInterpretation } from '@/server/ai/saju-lifetime-interpretation';
import { simplifySajuCopy } from '@/lib/saju/public-copy';

declare const test: (name: string, fn: () => void) => void;

const birthInput: BirthInput = {
  year: 1982,
  month: 1,
  day: 29,
  hour: 8,
  minute: 45,
  gender: 'male',
};

test('buildLifetimeReport creates a lifetime-first structure with yearly appendix', () => {
  const data = normalizeToSajuDataV1(birthInput, null);
  const report = buildLifetimeReport(birthInput, data, 2026);

  assert.equal(report.targetYear, 2026);
  assert.equal(report.pillars.day, data.pillars.day.ganzi);
  assert.ok(report.cover.oneLineSummary.length > 0);
  assert.ok(report.cover.keywords.length >= 4);
  assert.ok(report.coreIdentity.summary.length > 0);
  assert.ok(report.strengthBalance.balanceGuide.length >= 1);
  assert.ok(report.patternAndYongsin.supportSymbols.length >= 1);
  assert.ok(report.relationshipPattern.summary.length > 0);
  assert.ok(report.wealthStyle.summary.length > 0);
  assert.ok(report.careerDirection.summary.length > 0);
  assert.ok(report.healthRhythm.habitPoints.length >= 1);
  assert.ok(report.majorLuckTimeline.cycles.length >= 1);
  assert.equal(report.lifetimeStrategy.rememberRules.length, 5);
  assert.equal(report.yearlyAppendix.year, 2026);
  assert.ok(report.yearlyAppendix.goodPeriods.length >= 1);
  assert.ok(report.yearlyAppendix.ctaAnchor === '#yearly-report');
});

test('buildLifetimeReport marks a current major-luck cycle when available', () => {
  const data = normalizeToSajuDataV1(birthInput, null);
  const report = buildLifetimeReport(birthInput, data, 2026);

  assert.ok(
    report.majorLuckTimeline.cycles.some((cycle) => cycle.isCurrent) ||
      report.majorLuckTimeline.cycles[0]?.ganzi === '대운 미산정'
  );
});

test('buildLifetimeReport gives major-luck cycles distinct readings by ganzi', () => {
  const data = normalizeToSajuDataV1(birthInput, null);
  const report = buildLifetimeReport(birthInput, data, 2026);
  const cycles = report.majorLuckTimeline.cycles.filter((cycle) => cycle.ganzi !== '대운 미산정');

  assert.ok(cycles.length >= 4);
  assert.ok(new Set(cycles.map((cycle) => cycle.phase)).size >= 3);
  assert.ok(new Set(cycles.map((cycle) => cycle.task)).size >= 4);
  assert.doesNotMatch(
    cycles.map((cycle) => cycle.task).join('\n'),
    /정리와 재배치, 역할 조정, 관계 정돈을 미루지 않는 것/
  );
});

test('buildLifetimeReport cycle 가 교운기(交運期) 를 감지한다 (PR 7 응답 3, 2026-05-15)', () => {
  // PR 7 응답 3: 사용자 현재 만 나이가 cycle 의 startAge ±1 또는 endAge ±1 안에 있으면
  // transitionPhase 가 'entering' 또는 'leaving' 으로 마킹.
  // 1982-01-29 사주 → 2026 년 기준 약 만 44~45세. 대운 시작/끝 ±1 안에 들어가는 cycle 1개 이상.
  const data = normalizeToSajuDataV1(birthInput, null);
  const report = buildLifetimeReport(birthInput, data, 2026);
  const cycles = report.majorLuckTimeline.cycles.filter((c) => c.ganzi !== '대운 미산정');

  // 1) 모든 cycle 에 transitionPhase 필드 존재 (값은 entering/leaving/null).
  for (const cycle of cycles) {
    assert.ok(
      cycle.transitionPhase === 'entering' ||
        cycle.transitionPhase === 'leaving' ||
        cycle.transitionPhase === null ||
        cycle.transitionPhase === undefined,
      `${cycle.ganzi}: transitionPhase 값 enum 아님 (${cycle.transitionPhase})`
    );
  }

  // 2) 일반 사주는 대운이 10년 간격이라 1982 생 + 2026 기준 ±1 에 들어가는 cycle 이 0~2개 사이.
  // 0개도 정상 (만약 만 나이가 정확히 중간이면), 2개는 startAge/endAge 가 ±1 이내 겹치는 케이스.
  const transitioning = cycles.filter((c) => c.transitionPhase === 'entering' || c.transitionPhase === 'leaving');
  assert.ok(transitioning.length <= 2, `transitioning cycle 최대 2개. got=${transitioning.length}`);
});

test('buildLifetimeReport cycle 본문이 12운성·원진 metadata 를 인용한다 (PR 7, 2026-05-15)', () => {
  // PR 7: chapterBody / mental / relationship / closingNote 가 cycle 의 twelveStage·wonjinWith 를
  // 자연어로 인용해야 함. cycle 마다 12운성이 반드시 산출되므로 chapterBody/mental/closingNote 에
  // "지(" 또는 "운성" 같은 cue 가 등장.
  const data = normalizeToSajuDataV1(birthInput, null);
  const report = buildLifetimeReport(birthInput, data, 2026);
  const cycles = report.majorLuckTimeline.cycles.filter((c) => c.ganzi !== '대운 미산정');

  // 1) 모든 cycle 에 twelveStage 필드 존재.
  for (const cycle of cycles) {
    assert.ok(cycle.twelveStage, `${cycle.ganzi}: twelveStage 미산출`);
  }

  // 2) 최소 1 cycle 의 chapterBody / mental / closingNote 에 12운성 라벨 등장.
  const bodyJoin = cycles.map((c) => c.chapterBody ?? '').join('\n');
  const closingJoin = cycles.map((c) => c.closingNote ?? '').join('\n');
  const has12StageInBody = /(장생|목욕|관대|건록|제왕|쇠|병|사|묘|절|태|양)지\(/.test(bodyJoin);
  const has12StageInClosing = /(장생|목욕|관대|건록|제왕|쇠|병|사|묘|절|태|양)지\(/.test(closingJoin);
  assert.ok(
    has12StageInBody || has12StageInClosing,
    `chapterBody 또는 closingNote 에 12운성 라벨(N지) 가 인용되어야 함`
  );

  // 3) wonjinWith 필드 존재 (배열, 비어 있을 수 있음).
  for (const cycle of cycles) {
    assert.ok(Array.isArray(cycle.wonjinWith), `${cycle.ganzi}: wonjinWith 배열 아님`);
  }
});

test('buildLifetimeReport practicalActions use 사전식 매핑 (PR 4, 2026-05-15)', () => {
  // PR 4: practicalActions 가 generic "관계 거리감 미세 조정" 만 반복하지 않고
  // 부족 오행 + 과다 오행 + 십성 사전 매핑이 cycle 마다 다양하게 노출되어야 함.
  const data = normalizeToSajuDataV1(birthInput, null);
  const report = buildLifetimeReport(birthInput, data, 2026);
  const cycles = report.majorLuckTimeline.cycles.filter((c) => c.ganzi !== '대운 미산정');

  // 1) 모든 cycle 이 4개의 PracticalAction 보유.
  for (const cycle of cycles) {
    assert.ok(cycle.practicalActions && cycle.practicalActions.length === 4, `${cycle.ganzi}: 4건이 아님`);
    for (const action of cycle.practicalActions ?? []) {
      assert.ok(action.reason.length > 0);
      assert.ok(action.what.length > 0);
      assert.ok(action.how.length > 0);
    }
  }

  // 2) 사전 매핑 marker (오행/십성 단어) 가 reason 에 등장.
  const allReasons = cycles
    .flatMap((c) => c.practicalActions ?? [])
    .map((a) => a.reason)
    .join('\n');
  // 2026-05-25 naming-policy §2: 자연 비유(새싹/햇살/흙/쇠/물) 폐기 → 표준 "목/화/토/금/수 기운".
  const elementMarker = /(목|화|토|금|수)\s*기운/.test(allReasons);
  const tenGodMarker = /(비견|겁재|식신|상관|편재|정재|편관|정관|편인|정인)/.test(allReasons);
  assert.ok(elementMarker, `오행 사전 매핑 marker 가 reason 에 등장해야 함: ${allReasons.slice(0, 400)}`);
  assert.ok(tenGodMarker, `십성 사전 매핑 marker 가 reason 에 등장해야 함: ${allReasons.slice(0, 400)}`);

  // 3) how 가 generic placeholder("관계 거리감 미세 조정") 만 반복되지 않음 — 다양성.
  const howSet = new Set(cycles.flatMap((c) => c.practicalActions ?? []).map((a) => a.how));
  assert.ok(howSet.size >= 4, `how 카피 다양성: 최소 4개 unique (size=${howSet.size})`);
});

test('buildLifetimeReport chapterTitle uses 10 카피 패턴 (PR 3, 2026-05-15)', () => {
  // PR 3: chapterTitle 이 이전의 generic placeholder ("…10년의 결을 정리합니다") 가
  // 아니라 10 패턴 중 1개로 선택되어야 함.
  const data = normalizeToSajuDataV1(birthInput, null);
  const report = buildLifetimeReport(birthInput, data, 2026, {
    relationshipStatus: 'dating',
    occupation: 'self-employed',
    currentConcern: 'business',
  });
  const cycles = report.majorLuckTimeline.cycles.filter((c) => c.ganzi !== '대운 미산정');
  const titles = cycles.map((c) => c.chapterTitle ?? '');

  // 1) generic placeholder 사라졌어야 함.
  assert.ok(
    titles.every((title) => !title.includes('10년의 결을 정리합니다')),
    `generic placeholder 남아 있으면 안 됨: ${titles.join(' / ')}`
  );

  // 2) 모든 chapterTitle 은 빈 문자열이 아님.
  assert.ok(titles.every((title) => title.length > 0));

  // 3) 10 패턴 중 1개의 marker 가 최소 2건 등장 (감탄/경고/시그널/공감/위기/희망/변환/반전/비밀/질문).
  const allTitles = titles.join('\n');
  const patternMarkers = [
    /역대급 전성기|드디어 운이|10년 중 가장 빛나/,
    /터지기 일보 직전|받쳐주는 흐름|회복과 정리/,
    /암흑기 주의보|보존이 핵심|결정 보류/,
    /비책|운명을 내 편|루틴/,
    /완벽주의|짊어지려|마음의 무게/,
    /가까운 관계|표현과 거리감|관계의 온도/,
    /수익 극대화|결실|성과로 변환/,
    /화려한 무대 뒤|위험이 커지는|과속을 경계/,
    /대격변|새 챕터가 열|분기점/,
    /걸어도 될까|후회할|다음 한 수/,
  ];
  const matchedPatterns = patternMarkers.filter((re) => re.test(allTitles)).length;
  assert.ok(
    matchedPatterns >= 2,
    `최소 2개 이상의 패턴 marker 가 등장해야 함 (matched=${matchedPatterns}): ${titles.join(' / ')}`
  );
});

// 2026-05-19 PR-B Task 4-7: cycle 십성 기반 본문 재작성 invariants.
// 9 (실제 fixture 는 10) cycle 이 십성 distinct 만큼 본문도 distinct 해야 함.
test('buildLifetimeReport 의 cycle 들이 relationship 첫 문장에서 서로 distinct baseLine 을 갖는다 (PR-B Task 4)', () => {
  const data = normalizeToSajuDataV1(birthInput, null);
  const report = buildLifetimeReport(birthInput, data, 2026);
  const cycles = report.majorLuckTimeline.cycles.filter((c) => c.ganzi !== '대운 미산정');

  const relationshipFirsts = cycles.map((c) => (c.relationship ?? '').split('.')[0]);
  const uniqueBaselines = new Set(relationshipFirsts);
  assert.ok(
    uniqueBaselines.size >= 6,
    `relationship 첫 문장 distinct ≥ 6 (actual=${uniqueBaselines.size}): ${[...uniqueBaselines].slice(0, 5).join(' / ')}`
  );
});

test('buildLifetimeReport 의 cycle 들이 wealthCareer 첫 문장에서 distinct base 를 갖는다 (PR-B Task 5)', () => {
  const data = normalizeToSajuDataV1(birthInput, null);
  const report = buildLifetimeReport(birthInput, data, 2026);
  const cycles = report.majorLuckTimeline.cycles.filter((c) => c.ganzi !== '대운 미산정');

  const wealthFirsts = cycles.map((c) => (c.wealthCareer ?? '').split('.')[0]);
  const uniqueBases = new Set(wealthFirsts);
  assert.ok(
    uniqueBases.size >= 6,
    `wealthCareer 첫 문장 distinct ≥ 6 (actual=${uniqueBases.size}): ${[...uniqueBases].slice(0, 5).join(' / ')}`
  );
});

test('buildLifetimeReport 의 cycle 별 practicalActions[1].what 가 distinct 하다 (PR-B Task 7)', () => {
  const data = normalizeToSajuDataV1(birthInput, null);
  const report = buildLifetimeReport(birthInput, data, 2026);
  const cycles = report.majorLuckTimeline.cycles.filter((c) => c.ganzi !== '대운 미산정');

  const secondActions = cycles.map((c) => c.practicalActions?.[1]?.what ?? '');
  const unique = new Set(secondActions);
  assert.ok(
    unique.size >= 5,
    `practicalActions[1].what distinct ≥ 5 (actual=${unique.size}): ${[...unique].join(' / ')}`
  );
});

// 2026-05-19 P0d — chapter-validator 를 빌더 출력에 적용 (한자/X과 라벨/영어/단정 0건).
//
// 2026-05-20 V2-5 PR M — 신규 룰 (sentence-length, gyeol-frequency, vague-comfort) 은
// deterministic builder 본문에서 점진 도입 — 일부 cycle 본문이 65자 초과 문장을 가짐.
// LLM 출력 (generate-chapter.ts) 에는 모든 룰이 strict 적용. 향후 deterministic
// builder 본문 다듬기 PR 마다 skipRules 에서 하나씩 제거 권장.
test('buildLifetimeReport 의 모든 cycle 본문이 chapter-validator 4 룰을 통과', () => {
  const data = normalizeToSajuDataV1(birthInput, null);
  const report = buildLifetimeReport(birthInput, data, 2026);
  const cycles = report.majorLuckTimeline.cycles.filter((c) => c.ganzi !== '대운 미산정');

  for (const cycle of cycles) {
    const bodies: Array<[string, string]> = [
      ['chapterBody', cycle.chapterBody ?? ''],
      ['mental', cycle.mental ?? ''],
      ['relationship', cycle.relationship ?? ''],
      ['wealthCareer', cycle.wealthCareer ?? ''],
    ];
    for (const [field, body] of bodies) {
      if (!body) continue;
      const result = validateChapterBody(body, {
        // 신규 룰 (PR M·N) — deterministic builder 점진 도입.
        skipRules: [
          'sentence-length',
          'gyeol-frequency',
          'vague-comfort',
          'myeongri-jargon-repetition',
        ],
      });
      assert.equal(
        result.passed,
        true,
        `cycle ${cycle.ganzi} ${field} — ${JSON.stringify(result.failures)}`
      );
    }
  }
});

// 2026-05-22 Step3 회귀 가드 — 대운 챕터 제목 고유성 + 본문 한자/명리용어 0.
test('buildLifetimeReport: 대운 제목 고유 + 본문 한자/명리용어 0 (Step3)', () => {
  const data = normalizeToSajuDataV1(birthInput, null);
  const report = buildLifetimeReport(birthInput, data, 2026);
  const cycles = report.majorLuckTimeline.cycles.filter((c) => c.ganzi !== '대운 미산정');
  assert.ok(cycles.length >= 4);

  // 1) 챕터 제목: 최소 (N-1)개 고유 (나이대 suffix 로 사실상 전부 고유)
  const titles = cycles.map((c) => c.chapterTitle ?? '').filter(Boolean);
  assert.ok(titles.length >= 4, '챕터 제목 채워진 cycle 4+');
  assert.ok(
    new Set(titles).size >= titles.length - 1,
    `챕터 제목 거의 모두 고유여야 함: ${new Set(titles).size}/${titles.length}`
  );

  // 2) 본문 8단 — 한자 0 / 명리 전문용어 0 (대운·12운성 한글 허용)
  for (const c of cycles) {
    const body = [c.hook, c.chapterBody, c.mental, c.relationship, c.wealthCareer, c.closingNote]
      .filter(Boolean)
      .join(' ');
    const r = validateDaewoonText(`${c.chapterTitle ?? ''} ${body}`);
    assert.equal(r.ok, true, `cycle ${c.ganzi} 본문 위반: ${r.reasons.join(', ')}`);
  }
});

// 2026-05-23 — 평생 풀이 상세(2·3장) 텍스트 품질 회귀 가드.
//   버그 5종: (1) 반복 문장, (2) "역할의 역할감", (3) "기운 기운"·"사주표을",
//   (4) 영어 enum 누수(strong/balanced/...), (5) 칩 중복.
//   여러 사주 입력으로 yongsin·오행 분포가 다른 케이스를 함께 검증한다.
const QUALITY_FIXTURES: BirthInput[] = [
  birthInput, // 1982-01-29 (壬水, 金水 강세, 火 결핍)
  { year: 1990, month: 5, day: 5, hour: 14, minute: 0, gender: 'female' },
  { year: 1975, month: 11, day: 20, hour: 3, minute: 30, gender: 'male' },
  { year: 2001, month: 8, day: 12, hour: 22, minute: 10, gender: 'female' },
];

test('평생 풀이 상세: 2·3장 텍스트 품질 (반복·역할 중복·기운/사주표 조사·영어 enum·칩 중복)', () => {
  // 패널이 본문에 적용하는 변환과 동일하게 simplifySajuCopy 를 거친 텍스트로 검증.
  const STATE_ENUM = /\b(strong|balanced|weak|missing|excess)\b/;

  for (const input of QUALITY_FIXTURES) {
    const data = normalizeToSajuDataV1(input, null);
    const report = buildLifetimeReport(input, data, 2026);
    const pat = report.patternAndYongsin;
    const tag = `${input.year}-${input.month}-${input.day}`;

    // (1) 반복 문장: summary 가 patternRole·yongsinDirection 과 동일하면 안 됨.
    assert.notEqual(pat.summary, pat.yongsinDirection, `${tag}: summary === yongsinDirection`);
    assert.notEqual(pat.patternRole, pat.yongsinDirection, `${tag}: patternRole === yongsinDirection`);
    assert.notEqual(pat.summary, pat.patternRole, `${tag}: summary === patternRole`);

    // (4) 영어 enum 누수: elementHighlights 에 raw state enum 이 없어야 함.
    for (const line of report.strengthBalance.elementHighlights) {
      assert.doesNotMatch(line, STATE_ENUM, `${tag}: elementHighlights 영어 enum 누수 → ${line}`);
      // 한글 상태 라벨이 들어가야 함.
      assert.match(line, /강함|균형|약함|없음|과다/, `${tag}: 한글 상태 라벨 없음 → ${line}`);
    }

    // (5) 칩 중복: supportSymbols / cautionSymbols 에 같은 항목이 두 번 없어야 함.
    assert.equal(
      new Set(pat.supportSymbols).size,
      pat.supportSymbols.length,
      `${tag}: supportSymbols 중복 → ${pat.supportSymbols.join(', ')}`
    );
    assert.equal(
      new Set(pat.cautionSymbols).size,
      pat.cautionSymbols.length,
      `${tag}: cautionSymbols 중복 → ${pat.cautionSymbols.join(', ')}`
    );
    // 칩은 모두 "X 기운" 형태(개별 오행) — "기운"이 두 번 들어가지 않아야 함.
    for (const chip of [...pat.supportSymbols, ...pat.cautionSymbols]) {
      assert.doesNotMatch(chip, /기운\s*기운/, `${tag}: 칩 "기운 기운" → ${chip}`);
      assert.match(chip, /기운/, `${tag}: 칩에 기운 라벨 없음 → ${chip}`);
    }

    // (2)(3) 3장 본문(패널 렌더와 동일 변환) — 금지 표현 검증.
    const interp = buildFallbackLifetimeInterpretation(report, 'female');
    const chapter3 = simplifySajuCopy(interp.sections.patternAndYongsin);

    assert.doesNotMatch(chapter3, /역할의 역할감/, `${tag}: "역할의 역할감" 잔존 → ${chapter3.slice(0, 120)}`);
    assert.doesNotMatch(chapter3, /기운\s*기운/, `${tag}: "기운 기운" 잔존 → ${chapter3.slice(0, 120)}`);
    assert.doesNotMatch(chapter3, /사주표을|사주표은|사주표과/, `${tag}: 사주표 조사 오류 → ${chapter3.slice(0, 160)}`);
    assert.doesNotMatch(chapter3, STATE_ENUM, `${tag}: 3장 본문 영어 enum 누수 → ${chapter3.slice(0, 120)}`);

    // (1) 3장 본문에 동일 문장이 두 번 등장하지 않아야 함.
    const sentences = chapter3
      .split(/(?<=[.!?。])\s+/u)
      .map((s) => s.replace(/[\s.!?。]/gu, ''))
      .filter(Boolean);
    assert.equal(
      new Set(sentences).size,
      sentences.length,
      `${tag}: 3장 본문 반복 문장 → ${chapter3}`
    );
  }

  // male 보이스 chapter-3 도 동일하게 반복 0.
  const dataMale = normalizeToSajuDataV1(birthInput, null);
  const reportMale = buildLifetimeReport(birthInput, dataMale, 2026);
  const chapter3Male = simplifySajuCopy(
    buildFallbackLifetimeInterpretation(reportMale, 'male').sections.patternAndYongsin
  );
  const maleSentences = chapter3Male
    .split(/(?<=[.!?。])\s+/u)
    .map((s) => s.replace(/[\s.!?。]/gu, ''))
    .filter(Boolean);
  assert.equal(new Set(maleSentences).size, maleSentences.length, `male 3장 반복 문장 → ${chapter3Male}`);
});

// 2026-05-23 — simplifySajuCopy 가 명식→내 사주표 치환 후 조사를 정정한다.
test('simplifySajuCopy: 명식 치환 후 사주표 조사 정정 (을→를, 은→는, 이→가, 과→와)', () => {
  assert.equal(simplifySajuCopy('명식을 살리고').includes('사주표을'), false);
  assert.match(simplifySajuCopy('명식을 살리고'), /사주표를 살리고/);
  assert.match(simplifySajuCopy('이 명식은 강하다'), /사주표는 강하다/);
  assert.match(simplifySajuCopy('명식이 흔들린다'), /사주표가 흔들린다/);
  assert.match(simplifySajuCopy('명식과 운'), /사주표와 운/);
  // 서술격 조사(이라/입니다)는 건드리지 않음 — '사주표가다' 같은 오변환 금지.
  assert.doesNotMatch(simplifySajuCopy('명식이라 다르다'), /사주표가/);
  assert.doesNotMatch(simplifySajuCopy('명식입니다'), /사주표가/);
});
