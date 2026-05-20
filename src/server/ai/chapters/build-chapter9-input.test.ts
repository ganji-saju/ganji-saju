import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeToSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { buildLifetimeReport } from '@/domain/saju/report';
import type { BirthInput, UserSituation } from '@/lib/saju/types';
import {
  buildChapter9Input,
  extractChapterDigest,
} from './build-chapter9-input';

const birthInput: BirthInput = {
  year: 1982,
  month: 1,
  day: 29,
  hour: 8,
  minute: 45,
  gender: 'male',
};

const userSituation: UserSituation = {
  relationshipStatus: 'single',
  occupation: 'employee',
  currentConcern: 'business',
};

function buildBaseReport() {
  const sajuData = normalizeToSajuDataV1(birthInput, null);
  const report = buildLifetimeReport(birthInput, sajuData, 2026, userSituation);
  return { sajuData, report };
}

test('extractChapterDigest — 첫 문장 추출 (마침표 기준)', () => {
  assert.equal(
    extractChapterDigest('첫 문장입니다. 두 번째 문장.'),
    '첫 문장입니다.'
  );
  assert.equal(extractChapterDigest('한 문장만'), '한 문장만');
  assert.equal(extractChapterDigest(''), '');
});

test('extractChapterDigest — 50자 초과 시 49자 + …', () => {
  const long = 'ㄱ'.repeat(80);
  const result = extractChapterDigest(long);
  assert.ok(result.length <= 50, `결과 길이 ${result.length} > 50`);
  assert.ok(result.endsWith('…'), 'truncated 시 ellipsis 마무리');
});

test('extractChapterDigest — 줄바꿈을 문장 경계로 처리', () => {
  const result = extractChapterDigest('첫 줄\n두 번째 줄');
  assert.equal(result, '첫 줄');
});

test('buildChapter9Input — chapterId=9, chapter=CHAPTER_META[9] 매핑', () => {
  const { sajuData, report } = buildBaseReport();
  const input = buildChapter9Input(sajuData, userSituation, {
    coreIdentity: report.coreIdentity,
    strengthBalance: report.strengthBalance,
    patternAndYongsin: report.patternAndYongsin,
    relationshipPattern: report.relationshipPattern,
    wealthStyle: report.wealthStyle,
    careerDirection: report.careerDirection,
    healthRhythm: report.healthRhythm,
  });

  assert.equal(input.chapterId, 9);
  assert.equal(input.chapter.title, '평생 활용 전략');
  assert.match(input.chapter.lens, /평생 의사결정 원칙/);
});

test('buildChapter9Input — priorChapterDigests 7개 모두 채움 (1~7장)', () => {
  const { sajuData, report } = buildBaseReport();
  const input = buildChapter9Input(sajuData, userSituation, {
    coreIdentity: report.coreIdentity,
    strengthBalance: report.strengthBalance,
    patternAndYongsin: report.patternAndYongsin,
    relationshipPattern: report.relationshipPattern,
    wealthStyle: report.wealthStyle,
    careerDirection: report.careerDirection,
    healthRhythm: report.healthRhythm,
  });

  assert.ok(input.priorChapterDigests);
  assert.equal(input.priorChapterDigests!.length, 7);

  const chapterIds = input.priorChapterDigests!.map((d) => d.chapterId);
  assert.deepEqual(chapterIds, [1, 2, 3, 4, 5, 6, 7]);

  // 각 digest 가 비어있지 않은지 (baseReport 가 모든 챕터에 summary 를 만드는 것 검증)
  for (const digest of input.priorChapterDigests!) {
    assert.ok(digest.digest.length > 0, `챕터 ${digest.chapterId} digest 비어있음`);
    assert.ok(
      digest.digest.length <= 50,
      `챕터 ${digest.chapterId} digest 50자 초과: "${digest.digest}"`
    );
  }
});

test('buildChapter9Input — buildChapter1Input 의 saju 변환 재사용 (한자 0건)', () => {
  const { sajuData, report } = buildBaseReport();
  const input = buildChapter9Input(sajuData, userSituation, {
    coreIdentity: report.coreIdentity,
    strengthBalance: report.strengthBalance,
    patternAndYongsin: report.patternAndYongsin,
    relationshipPattern: report.relationshipPattern,
    wealthStyle: report.wealthStyle,
    careerDirection: report.careerDirection,
    healthRhythm: report.healthRhythm,
  });

  // pillars 는 한글 ganzi 로 변환되어야 함 (buildChapter1Input 의 saju 변환 재사용 확인)
  const HANJA_PATTERN = /[一-鿿]/;
  assert.ok(!HANJA_PATTERN.test(input.saju.pillars.year), 'year 한자 0건');
  assert.ok(!HANJA_PATTERN.test(input.saju.pillars.day), 'day 한자 0건');
  // dayMaster.element 는 5 자연 비유 라벨 중 하나 (실제 사주 계산 결과 의존)
  const ELEMENT_LABELS = ['목 기운', '화 기운', '토 기운', '금 기운', '수 기운'];
  assert.ok(
    ELEMENT_LABELS.includes(input.saju.dayMaster.element),
    `dayMaster.element "${input.saju.dayMaster.element}" 가 자연 비유 5 라벨에 포함 안 됨`
  );
});

test('buildChapter9Input — userSituation null 도 안전 (synthesis 자체는 가능)', () => {
  const { sajuData, report } = buildBaseReport();
  const input = buildChapter9Input(sajuData, null, {
    coreIdentity: report.coreIdentity,
    strengthBalance: report.strengthBalance,
    patternAndYongsin: report.patternAndYongsin,
    relationshipPattern: report.relationshipPattern,
    wealthStyle: report.wealthStyle,
    careerDirection: report.careerDirection,
    healthRhythm: report.healthRhythm,
  });

  assert.equal(input.userContext.relationshipStatus, null);
  assert.equal(input.userContext.occupation, null);
  assert.equal(input.userContext.currentConcern, null);
  // priorChapterDigests 는 사용자 컨텍스트와 무관 — 그대로 7개
  assert.equal(input.priorChapterDigests!.length, 7);
});
