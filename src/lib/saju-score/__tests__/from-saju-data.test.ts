import assert from 'node:assert/strict';
import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { sajuDataToScoreInput, computeSajuScoreFromData } from '../from-saju-data';

// 2026-05-21 — 엔진 SajuDataV1/V2 → 점수 SajuData 어댑터(Phase 6). 한자→한글 + null 폴백.

declare const test: (name: string, fn: () => void | Promise<void>) => void;

function makeV1(overrides: Record<string, unknown> = {}): SajuDataV1 {
  const base = {
    pillars: {
      year: { stem: '甲', branch: '子' },
      month: { stem: '丙', branch: '寅' },
      day: { stem: '戊', branch: '辰' },
      hour: { stem: '庚', branch: '午' },
    },
    dayMaster: { stem: '戊', element: '토' },
    pattern: { name: '식신격' },
    yongsin: { primary: { value: '목' }, secondary: [{ value: '수' }] },
    strength: { level: '중화' },
  };
  return { ...base, ...overrides } as unknown as SajuDataV1;
}

test('sajuDataToScoreInput: 한자→한글 변환 + 8글자/기둥 매핑', () => {
  const s = sajuDataToScoreInput(makeV1());
  assert.deepEqual(s.yeonju, { gan: '갑', ji: '자' });
  assert.deepEqual(s.wolju, { gan: '병', ji: '인' });
  assert.deepEqual(s.ilju, { gan: '무', ji: '진' });
  assert.deepEqual(s.siju, { gan: '경', ji: '오' });
  assert.equal(s.ilgan, '무');
  assert.deepEqual(s.cheongan, ['갑', '병', '무', '경']);
  assert.deepEqual(s.jiji, ['자', '인', '진', '오']);
  assert.deepEqual(s.allEightChars, ['갑', '자', '병', '인', '무', '진', '경', '오']);
});

test('sajuDataToScoreInput: 명리 필드 매핑 + 기본값', () => {
  const s = sajuDataToScoreInput(makeV1());
  assert.equal(s.kyeokguk, '식신격');
  assert.equal(s.yongsin, '목');
  assert.equal(s.yongsin_secondary, '수');
  assert.equal(s.ganguk, '중화');
  assert.deepEqual(s.gilsinList, []);
  assert.deepEqual(s.hyungsalList, []);
  assert.equal(s.hasGongmang, false);
});

test('sajuDataToScoreInput: null pattern/yongsin/strength → 안전 기본값', () => {
  const s = sajuDataToScoreInput(makeV1({ pattern: null, yongsin: null, strength: null }));
  assert.equal(s.kyeokguk, ''); // F2 가 편격 baseline 처리
  assert.equal(s.yongsin, '토'); // dayMaster.element 폴백
  assert.equal(s.ganguk, '중화'); // 기본 중화
});

test('sajuDataToScoreInput: 시주 null → siju 빈 문자(crash 없음)', () => {
  const v1 = makeV1({
    pillars: {
      year: { stem: '甲', branch: '子' },
      month: { stem: '丙', branch: '寅' },
      day: { stem: '戊', branch: '辰' },
      hour: null,
    },
  });
  const s = sajuDataToScoreInput(v1);
  assert.equal(s.siju.gan, '');
  assert.equal(s.siju.ji, '');
  assert.equal(s.ilgan, '무');
});

test('computeSajuScoreFromData: 유효 SajuScore 반환(0~100 + 라벨 + 5내역 + 오행)', () => {
  const score = computeSajuScoreFromData(makeV1());
  assert.ok(score.total >= 0 && score.total <= 100, `total ${score.total}`);
  assert.ok(['excellent', 'good', 'neutral', 'mindful', 'potential'].includes(score.label.level));
  for (const k of ['F1', 'F2', 'F3', 'F4', 'F5'] as const) {
    assert.equal(typeof score.breakdown[k], 'number');
  }
  assert.equal(score.ohaengChart.total, 8);
});

test('computeSajuScoreFromData: 시주 null 도 crash 없이 점수 산출', () => {
  const v1 = makeV1({
    pillars: {
      year: { stem: '甲', branch: '子' },
      month: { stem: '丙', branch: '寅' },
      day: { stem: '戊', branch: '辰' },
      hour: null,
    },
  });
  const score = computeSajuScoreFromData(v1);
  assert.ok(score.total >= 0 && score.total <= 100);
});
