import assert from 'node:assert/strict';
import {
  cycleFortuneScore,
  firstSentences,
  monthKeywordForScore,
  pickInterpretationText,
  resolvePdfSubjectName,
} from './pdf-report-text';

// 2026-05-25 — PDF 실데이터 반영용 순수 헬퍼(이름 해결·LLM 섹션 선택·문장 트림).

declare const test: (name: string, fn: () => void | Promise<void>) => void;

test('resolvePdfSubjectName: input.name 우선, 없으면 displayName, 둘 다 없으면 중립(달빛이 아님)', () => {
  assert.equal(resolvePdfSubjectName({ name: '김영민' }), '김영민');
  assert.equal(resolvePdfSubjectName({ name: '  김영민  ' }), '김영민');
  assert.equal(resolvePdfSubjectName({ name: null }, { displayName: '영민' }), '영민');
  const fallback = resolvePdfSubjectName({ name: null }, { displayName: null });
  assert.equal(fallback, '고객');
  assert.notEqual(fallback, '달빛이');
});

test('pickInterpretationText: 섹션 있으면 그 텍스트(trim), 없으면 fallback', () => {
  const interp = { sections: { coreIdentity: '  실제 풀이 본문  ', wealthStyle: '' } };
  assert.equal(pickInterpretationText(interp, 'coreIdentity', 'GEN'), '실제 풀이 본문');
  assert.equal(pickInterpretationText(interp, 'wealthStyle', 'GEN'), 'GEN'); // 빈 문자열 → fallback
  assert.equal(pickInterpretationText(interp, 'careerDirection', 'GEN'), 'GEN'); // 키 없음
  assert.equal(pickInterpretationText(null, 'coreIdentity', 'GEN'), 'GEN'); // interpretation 없음
});

test('firstSentences: 첫 N문장, 단문은 그대로', () => {
  assert.equal(firstSentences('첫 문장입니다. 둘째 문장. 셋째.', 1), '첫 문장입니다.');
  assert.equal(firstSentences('첫 문장입니다. 둘째 문장. 셋째.', 2), '첫 문장입니다. 둘째 문장.');
  assert.equal(firstSentences('문장 하나', 1), '문장 하나');
  assert.equal(firstSentences('', 1), '');
});

test('cycleFortuneScore: 일간 대비 오행 생극(십성)으로 결정론 점수 — 사주별 상이', () => {
  // 인성(cycle 生 일간) 최고 → 비화 → 식상 → 재 → 관 순.
  assert.equal(cycleFortuneScore('수', '목'), 85); // 수생목 = 인성
  assert.equal(cycleFortuneScore('목', '목'), 80); // 비화
  assert.equal(cycleFortuneScore('화', '목'), 76); // 목생화 = 식상
  assert.equal(cycleFortuneScore('토', '목'), 70); // 목극토 = 재
  assert.equal(cycleFortuneScore('금', '목'), 66); // 금극목 = 관
  // 같은 cycle 천간이라도 일간이 다르면 점수 다름(사주별 상이) 검증
  assert.notEqual(cycleFortuneScore('수', '목'), cycleFortuneScore('수', '화'));
});

test('monthKeywordForScore: 점수대별 키워드(실 monthScores 기반)', () => {
  assert.equal(monthKeywordForScore(90), '도약');
  assert.equal(monthKeywordForScore(75), '성장');
  assert.equal(monthKeywordForScore(60), '유지');
  assert.equal(monthKeywordForScore(50), '점검');
  assert.equal(monthKeywordForScore(30), '정비');
});
