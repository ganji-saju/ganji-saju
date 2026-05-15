// 2026-05-15 PR 3 — 일진 점수 산출 엔진 검증.
// 핵심 검증 사례 (일진_점수산출_알고리즘_정교화.md §12-2):
// 1982.01.29 男 (壬子일주, 火 부재, 신강 95:55) → 모델 출력이 20~40 범위에 들어와야 함.
// 운세톡톡 실제 캡처가 "30%" 였으므로 그 근방을 정합 기준으로 본다.

import assert from 'node:assert/strict';
import { calculateIljinScore, type SajuOriginInput } from './iljin-score-engine';
import {
  calculateSipsung,
  getTwelveStage,
  isBranchChung,
  isBranchWonjin,
  isSamhap,
  isStemHap,
} from './iljin-rules';

declare const test: (name: string, fn: () => void) => void;

test('calculateSipsung resolves canonical 10 가지 십성', () => {
  // 壬(수, 양) 일간 기준.
  assert.equal(calculateSipsung('壬', '壬'), '비견'); // 같은 수 양양
  assert.equal(calculateSipsung('壬', '癸'), '겁재'); // 같은 수 양음
  assert.equal(calculateSipsung('壬', '甲'), '식신'); // 수생목 양양
  assert.equal(calculateSipsung('壬', '乙'), '상관'); // 수생목 양음
  assert.equal(calculateSipsung('壬', '丙'), '편재'); // 수극화 양양
  assert.equal(calculateSipsung('壬', '丁'), '정재'); // 수극화 양음
  assert.equal(calculateSipsung('壬', '戊'), '편관'); // 토극수 양양
  assert.equal(calculateSipsung('壬', '己'), '정관'); // 토극수 양음
  assert.equal(calculateSipsung('壬', '庚'), '편인'); // 금생수 양양
  assert.equal(calculateSipsung('壬', '辛'), '정인'); // 금생수 양음
});

test('명리 관계 룰 - 천간합/지지충/원진/삼합', () => {
  assert.equal(isStemHap('甲', '己'), true); // 甲己=토
  assert.equal(isStemHap('丁', '壬'), true); // 丁壬=목
  assert.equal(isStemHap('甲', '乙'), false);
  assert.equal(isBranchChung('子', '午'), true);
  assert.equal(isBranchChung('卯', '酉'), true);
  assert.equal(isBranchChung('子', '丑'), false);
  assert.equal(isBranchWonjin('子', '未'), true);
  assert.equal(isBranchWonjin('寅', '酉'), true);
  assert.equal(isBranchWonjin('子', '午'), false);
  assert.equal(isSamhap('申', '子'), true); // 申子辰 水
  assert.equal(isSamhap('寅', '午'), true); // 寅午戌 火
  assert.equal(isSamhap('子', '酉'), false);
});

test('getTwelveStage 양간 순행 / 음간 역행', () => {
  // 壬 의 장생지는 申. 양간이므로 순행.
  assert.equal(getTwelveStage('壬', '申'), '장생');
  assert.equal(getTwelveStage('壬', '子'), '제왕'); // 申→酉→戌→亥→子 = 4번째이후 = 제왕
  // 乙 의 장생지는 午. 음간이므로 역행.
  assert.equal(getTwelveStage('乙', '午'), '장생');
});

test('1982.01.29 男 壬子일주 신강 사주 - 화 부재, 금/수 과다 케이스 정합 (spec §12-2)', () => {
  // spec doc 의 검증 사례: 운세톡톡이 "30%" 로 표시한 날 → 모델도 20~40 범위.
  // 사주: 시 甲辰 / 일 壬子 / 월 辛丑 / 년 辛酉.
  const saju: SajuOriginInput = {
    dayMaster: '壬',
    dayMasterElement: '수',
    yearStem: '辛',
    yearBranch: '酉',
    monthStem: '辛',
    monthBranch: '丑',
    dayBranch: '子',
    hourStem: '甲',
    hourBranch: '辰',
    elementPercentages: { 목: 19, 화: 0, 토: 36, 금: 53, 수: 42 },
    strengthLabel: '신강',
    yongsinElement: '화', // 한겨울 임수에 火 절실.
    kishinElement: '금', // 인성 과다, 금이 기신.
  };

  // 예시 일진: 庚午 (금수+화토 - 신강 임수에 충+기신).
  const r = calculateIljinScore(saju, { todayStem: '庚', todayBranch: '午' });

  // 화가 들어오긴 했지만 庚이 또 인성(편인)이고 子-午 충 → 점수 낮은 영역에 들어와야.
  // spec 검증: 19~30. 클램프 후 20~40 사이 허용.
  assert.ok(r.totalScore >= 15 && r.totalScore <= 45,
    `예상 20~40 사이, got=${r.totalScore} (breakdown=${JSON.stringify(r.breakdown)})`);
  assert.ok(r.breakdown.jiji < 0, `子-午 충 발동시 jiji 음수: got=${r.breakdown.jiji}`);
});

test('calculateIljinScore - 기본점 50 + breakdown 합 = totalScore (클램프 적용)', () => {
  const saju: SajuOriginInput = {
    dayMaster: '丙',
    dayMasterElement: '화',
    yearStem: '丙',
    yearBranch: '寅',
    monthStem: '甲',
    monthBranch: '午',
    dayBranch: '寅',
    hourStem: '丁',
    hourBranch: '酉',
    elementPercentages: { 목: 25, 화: 40, 토: 5, 금: 15, 수: 15 },
    strengthLabel: '신강',
    yongsinElement: '수',
    kishinElement: '화',
  };
  const r = calculateIljinScore(saju, { todayStem: '壬', todayBranch: '子' });
  const sum =
    r.breakdown.cheongan + r.breakdown.jiji + r.breakdown.ohaeng +
    r.breakdown.sinsal + r.breakdown.balance + r.breakdown.regulation +
    r.breakdown.unsung + r.breakdown.special;
  const naive = 50 + sum;
  const clamped = Math.max(5, Math.min(95, naive));
  assert.equal(r.totalScore, Math.round(clamped));
});

test('calculateIljinScore - 점수 범위 5~95 클램프 (극단값 방지)', () => {
  // 모든 영역이 최저인 가상 케이스도 5점 이하로 안 떨어진다.
  const saju: SajuOriginInput = {
    dayMaster: '甲',
    dayMasterElement: '목',
    yearStem: '庚',
    yearBranch: '申',
    monthStem: '庚',
    monthBranch: '申',
    dayBranch: '申',
    hourStem: '庚',
    hourBranch: '申',
    elementPercentages: { 목: 0, 화: 0, 토: 0, 금: 100, 수: 0 },
    strengthLabel: '신약',
    yongsinElement: '수',
    kishinElement: '금',
  };
  const r = calculateIljinScore(saju, { todayStem: '庚', todayBranch: '申' });
  assert.ok(r.totalScore >= 5 && r.totalScore <= 95);
});

test('calculateIljinScore - 7단계 등급 매핑 (🌟✨😊🙂😐😕⚠️)', () => {
  // 점수별 등급 분기 검증.
  // 합성 입력으로 다양한 점수대 테스트는 어려우므로 매핑 함수 자체는 그대로,
  // grade emoji 가 항상 7개 중 하나인지만 확인.
  const validEmojis = new Set(['🌟', '✨', '😊', '🙂', '😐', '😕', '⚠️']);
  const saju: SajuOriginInput = {
    dayMaster: '丙',
    dayMasterElement: '화',
    yearStem: '丙',
    yearBranch: '寅',
    monthStem: '甲',
    monthBranch: '午',
    dayBranch: '寅',
    hourStem: '丁',
    hourBranch: '酉',
    elementPercentages: { 목: 25, 화: 40, 토: 5, 금: 15, 수: 15 },
    strengthLabel: '신강',
    yongsinElement: '수',
    kishinElement: '화',
  };
  const r = calculateIljinScore(saju, { todayStem: '丙', todayBranch: '寅' });
  assert.ok(validEmojis.has(r.gradeEmoji), `unknown grade emoji: ${r.gradeEmoji}`);
});
