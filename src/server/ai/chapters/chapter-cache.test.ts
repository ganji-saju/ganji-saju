import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChapterCacheKey,
  isChapterCacheFresh,
  parseEnabledChapterIds,
  isChapterLLMEnabled,
  CHAPTER_CACHE_TTL_DAYS,
} from './chapter-cache';
import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import type { ChapterUserContext } from './chapter-input-types';

const fakeSajuData = {
  pillars: {
    year: { ganzi: '甲午' },
    month: { ganzi: '丙寅' },
    day: { ganzi: '己巳' },
    hour: { ganzi: '甲子' },
  },
  dayMaster: { stem: '己', element: '토' },
} as unknown as SajuDataV1;

const baseUserContext: ChapterUserContext = {
  name: '홍길동',
  age: 35,
  relationshipStatus: 'married',
  occupation: 'employee',
  currentConcern: 'wealth',
};

test('buildChapterCacheKey — 동일 input 은 동일 sha256 (안정성)', () => {
  const k1 = buildChapterCacheKey(fakeSajuData, baseUserContext, 1);
  const k2 = buildChapterCacheKey(fakeSajuData, baseUserContext, 1);
  assert.equal(k1, k2);
  assert.equal(k1.length, 64); // sha256 hex
});

test('buildChapterCacheKey — chapterId 가 다르면 다른 key', () => {
  const k1 = buildChapterCacheKey(fakeSajuData, baseUserContext, 1);
  const k4 = buildChapterCacheKey(fakeSajuData, baseUserContext, 4);
  assert.notEqual(k1, k4);
});

test('buildChapterCacheKey — name 변경은 key 영향 없음 (relevantFields 만)', () => {
  const k1 = buildChapterCacheKey(fakeSajuData, baseUserContext, 1);
  const k2 = buildChapterCacheKey(
    fakeSajuData,
    { ...baseUserContext, name: '이순신' },
    1
  );
  assert.equal(k1, k2);
});

test('buildChapterCacheKey — age 변경은 key 변경', () => {
  const k1 = buildChapterCacheKey(fakeSajuData, baseUserContext, 1);
  const k2 = buildChapterCacheKey(fakeSajuData, { ...baseUserContext, age: 40 }, 1);
  assert.notEqual(k1, k2);
});

test('buildChapterCacheKey — pillars ganzi 변경은 key 변경', () => {
  const k1 = buildChapterCacheKey(fakeSajuData, baseUserContext, 1);
  const altSaju = {
    ...fakeSajuData,
    pillars: { ...fakeSajuData.pillars, day: { ganzi: '庚午' } },
  } as unknown as SajuDataV1;
  const k2 = buildChapterCacheKey(altSaju, baseUserContext, 1);
  assert.notEqual(k1, k2);
});

test('isChapterCacheFresh — 생성 직후는 fresh', () => {
  const now = new Date('2026-05-19T12:00:00Z');
  const generatedAt = new Date('2026-05-19T11:59:59Z').toISOString();
  assert.equal(isChapterCacheFresh(generatedAt, CHAPTER_CACHE_TTL_DAYS, now), true);
});

test('isChapterCacheFresh — TTL 경계 (29.9 day) fresh, (30.1 day) stale', () => {
  const now = new Date('2026-06-18T12:00:00Z');
  const fresh = new Date('2026-05-19T15:00:00Z').toISOString(); // 29.875 day 전
  const stale = new Date('2026-05-19T09:00:00Z').toISOString(); // 30.125 day 전
  assert.equal(isChapterCacheFresh(fresh, CHAPTER_CACHE_TTL_DAYS, now), true);
  assert.equal(isChapterCacheFresh(stale, CHAPTER_CACHE_TTL_DAYS, now), false);
});

test('isChapterCacheFresh — invalid date 는 stale', () => {
  assert.equal(isChapterCacheFresh('not-a-date'), false);
  assert.equal(isChapterCacheFresh(''), false);
});

test('parseEnabledChapterIds — 빈 값', () => {
  assert.equal(parseEnabledChapterIds(undefined).size, 0);
  assert.equal(parseEnabledChapterIds('').size, 0);
});

test('parseEnabledChapterIds — 단일 id', () => {
  const enabled = parseEnabledChapterIds('1');
  assert.deepEqual([...enabled].sort(), [1]);
});

test('parseEnabledChapterIds — 콤마 구분 다중', () => {
  const enabled = parseEnabledChapterIds('1,4,5');
  assert.deepEqual([...enabled].sort(), [1, 4, 5]);
});

test('parseEnabledChapterIds — 범위 (dash)', () => {
  const enabled = parseEnabledChapterIds('1-9');
  assert.deepEqual([...enabled].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test('parseEnabledChapterIds — 혼합 (1,4-7)', () => {
  const enabled = parseEnabledChapterIds('1,4-7');
  assert.deepEqual([...enabled].sort((a, b) => a - b), [1, 4, 5, 6, 7]);
});

test('parseEnabledChapterIds — 1~9 범위 밖 무시', () => {
  const enabled = parseEnabledChapterIds('0,10,5,99');
  assert.deepEqual([...enabled].sort(), [5]);
});

test('isChapterLLMEnabled — flag off 이면 항상 false', () => {
  const env = { OPENAI_INTERPRET_CHAPTERS: '0', OPENAI_INTERPRET_CHAPTER_IDS: '1-9' };
  assert.equal(isChapterLLMEnabled(1, env as unknown as NodeJS.ProcessEnv), false);
});

test('isChapterLLMEnabled — flag on + chapter 활성', () => {
  const env = { OPENAI_INTERPRET_CHAPTERS: '1', OPENAI_INTERPRET_CHAPTER_IDS: '1,4' };
  assert.equal(isChapterLLMEnabled(1, env as unknown as NodeJS.ProcessEnv), true);
  assert.equal(isChapterLLMEnabled(4, env as unknown as NodeJS.ProcessEnv), true);
  assert.equal(isChapterLLMEnabled(2, env as unknown as NodeJS.ProcessEnv), false);
});

test('isChapterLLMEnabled — flag on + 챕터 ID 미설정 = 모든 챕터 disable', () => {
  const env = { OPENAI_INTERPRET_CHAPTERS: '1' };
  assert.equal(isChapterLLMEnabled(1, env as unknown as NodeJS.ProcessEnv), false);
});
