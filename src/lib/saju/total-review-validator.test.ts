import assert from 'node:assert/strict';
import {
  validateTotalReview,
  validateTotalReviewSection,
  hasHardTotalReviewViolation,
} from './total-review-validator';
import type { TotalReviewOutput } from '@/server/ai/total-review/total-review-types';

// 2026-05-21 — 총평 검증 §7 10항목. GOOD = 28문장 모범 답안(0 한자·0 명리어·일일톤 0·
//   컨텍스트 반영·문장수 28·카드 3). BAD = 한자/일일톤/컨텍스트 미반영.

declare const test: (name: string, fn: () => void | Promise<void>) => void;

const GOOD: TotalReviewOutput = {
  one_line_summary: '조용히 살피고 흐르는 사주, 단단한 기준 하나가 평생을 받쳐줍니다',
  main_narrative: {
    paragraph_1_who_you_are:
      '테스트 님의 타고난 흐름은 물처럼 부드럽게 이어집니다. 강하게 밀어붙이기보다 주변을 먼저 살피는 편이에요. 필요한 곳에 자연스럽게 자기를 맞추는 성향입니다. 사람들에게 편안한 사람이라는 인상을 자주 줍니다. 오래 같이 있고 싶은 사람으로 기억되기 쉬워요. 다만 자기 축이 다소 무를 때가 있습니다. 너무 많은 일에 둘러싸이면 본인 속도를 잃기 쉬워요.',
    paragraph_2_strong_environment:
      '이 사주는 살피고 조정하는 자리에서 강점이 가장 잘 드러납니다. 분석과 기획, 상담과 교육처럼 전체 흐름을 보는 영역이 잘 맞아요. 직장인으로 일하시는 지금도 전체를 조율하는 역할일수록 만족도가 높아집니다. 회사 안에서 중간을 잇는 자리에서 특히 빛이 납니다. 사람 관계에서는 한 명 한 명 깊게 가는 편이 잘 맞아요. 큰 모임의 중심보다 신뢰하는 소수와의 자리가 편합니다. 가까운 사이에서 오래가는 인연을 잘 만들어요.',
    paragraph_3_weak_zone:
      '본인의 약점은 단호함이 흐려질 때 나옵니다. 너무 많은 부탁을 받아들이다 지치기 쉬워요. 거절해야 할 자리에서 말을 아끼다 기회를 놓칩니다. 본인 의견을 미루고 알아서 되겠지 하고 넘기기도 합니다. 이게 쌓이면 정작 본인이 가장 힘들어집니다. 기준을 또렷이 세우는 힘이 부족할 때 흔들립니다. 마무리를 미루는 습관이 반복되면 피로가 누적돼요.',
    paragraph_4_now:
      '지금 지나는 10년은 겉으로 드러나는 일이 많아지는 시기예요. 본인이 직접 정해야 할 자리가 점점 늘어납니다. 재물과 투자 쪽 고민이 있으신데 단단한 구조를 들이는 게 핵심입니다. 체크리스트와 예산표처럼 손에 잡히는 도구를 곁에 두세요. 매월 한 번 정산표를 정리하는 습관이 큰 힘이 됩니다. 기혼이신 만큼 배우자와 가계의 큰 그림을 한 줄로 맞춰두면 좋아요. 큰 결정을 한 번에 내리기보다 작은 선택을 여러 번 쌓는 방식이 잘 맞아요.',
  },
  lifetime_keys: [
    {
      title: '살피고 조정하는 자리',
      subtitle: '전체 흐름을 보는 역할',
      body: '분석과 기획, 상담과 교육처럼 전체를 살피는 영역에서 강점이 잘 드러납니다. 큰 결정자보다 흐름을 조율하는 자리가 자연스러워요.',
    },
    {
      title: '단호함과 마무리',
      subtitle: '거절의 기준이 평생 자산',
      body: '받아들이지 않을 일의 기준 한두 개를 미리 적어두세요. 거절선이 또렷하면 에너지가 새지 않습니다.',
    },
    {
      title: '단단한 구조 들이기',
      subtitle: '손에 잡히는 도구가 보강',
      body: '체크리스트와 예산표, 정기 점검표 같은 도구가 큰 힘이 됩니다. 구조 위에서 흐르는 방식이 잘 맞아요.',
    },
  ],
};

const CTX = { occupationStatus: '직장인', concern: '재물·투자', userName: '테스트' };

test('validateTotalReview: 모범 답안(28문장)은 통과한다', () => {
  const r = validateTotalReview(GOOD, CTX);
  assert.ok(r.ok, `통과해야 함: ${r.reasons.join(' / ')}`);
});

test('validateTotalReview: 한자가 있으면 실패', () => {
  const bad = structuredClone(GOOD);
  bad.one_line_summary = '癸未 일주의 흐름을 가진 사주예요';
  const r = validateTotalReview(bad, CTX);
  assert.ok(!r.ok);
  assert.ok(r.reasons.some((x) => x.includes('한자')), r.reasons.join(' / '));
});

test('validateTotalReview: 일일 톤(오늘은)이 있으면 실패', () => {
  const bad = structuredClone(GOOD);
  bad.main_narrative.paragraph_1_who_you_are += ' 오늘은 무리하지 않는 게 좋아요.';
  const r = validateTotalReview(bad, CTX);
  assert.ok(r.reasons.some((x) => x.includes('일일 톤')), r.reasons.join(' / '));
});

test('validateTotalReview: 단락 2에 직업 컨텍스트 미반영 시 실패', () => {
  const bad = structuredClone(GOOD);
  bad.main_narrative.paragraph_2_strong_environment =
    '여러 자리에서 두루 어울리는 편입니다. 새로운 모임에도 잘 적응합니다. 분위기를 빠르게 읽어내는 감각이 있어요. 처음 보는 사람과도 금세 편해집니다. 다양한 상황에 유연하게 맞춰갑니다. 변화가 와도 크게 흔들리지 않아요. 어디서든 자기 자리를 찾아냅니다.';
  const r = validateTotalReview(bad, CTX);
  assert.ok(r.reasons.some((x) => x.includes('단락 2 직업')), r.reasons.join(' / '));
});

test('validateTotalReview: 단락 4에 고민 컨텍스트 미반영 시 실패', () => {
  const bad = structuredClone(GOOD);
  bad.main_narrative.paragraph_4_now =
    '지금 지나는 10년은 드러나는 일이 많아지는 시기예요. 직접 정해야 할 자리가 늘어납니다. 단단한 구조를 들이는 게 핵심입니다. 손에 잡히는 도구를 곁에 두세요. 매월 한 번 정리하는 습관이 힘이 됩니다. 배우자와 큰 그림을 맞춰두면 좋아요. 작은 선택을 여러 번 쌓는 방식이 잘 맞아요.';
  const r = validateTotalReview(bad, CTX);
  assert.ok(r.reasons.some((x) => x.includes('고민 컨텍스트')), r.reasons.join(' / '));
});

test('validateTotalReview: 금지 명리어(식신격) 있으면 실패', () => {
  const bad = structuredClone(GOOD);
  bad.main_narrative.paragraph_1_who_you_are += ' 식신격의 결이 뚜렷합니다.';
  const r = validateTotalReview(bad, CTX);
  assert.ok(r.reasons.some((x) => x.includes('금지 용어')), r.reasons.join(' / '));
});

test('validateTotalReviewSection: one_line_summary 정상 통과', () => {
  const r = validateTotalReviewSection('one_line_summary', {
    one_line_summary: GOOD.one_line_summary,
  });
  assert.ok(r.ok, r.reasons.join(' / '));
});

test('validateTotalReviewSection: main_narrative 한자 누출 시 실패', () => {
  const r = validateTotalReviewSection('main_narrative', {
    main_narrative: {
      ...GOOD.main_narrative,
      paragraph_1_who_you_are: '甲木 흐름이에요.',
    },
  });
  assert.ok(!r.ok);
});

test('validateTotalReviewSection: lifetime_keys 2개면 실패', () => {
  const r = validateTotalReviewSection('lifetime_keys', {
    lifetime_keys: GOOD.lifetime_keys.slice(0, 2),
  });
  assert.ok(!r.ok);
  assert.ok(r.reasons.some((x) => x.includes('항목 수')));
});

test('hasHardTotalReviewViolation: 정상 false, 한자 true', () => {
  assert.equal(hasHardTotalReviewViolation(GOOD), false);
  const bad = structuredClone(GOOD);
  bad.lifetime_keys[0].body = '金 기운이 핵심이에요.';
  assert.equal(hasHardTotalReviewViolation(bad), true);
});

test('validateTotalReview: 어휘 정책 위반("쇠의 결") 시 실패 (naming-policy §12)', () => {
  const bad = structuredClone(GOOD);
  bad.main_narrative.paragraph_4_now += ' 쇠의 결이 부족한 사주예요.';
  const r = validateTotalReview(bad, CTX);
  assert.ok(!r.ok);
  assert.ok(r.reasons.some((x) => x.includes('어휘 정책')), r.reasons.join(' / '));
});

test('validateTotalReview: 십성 추상명사화("표현의 기운") 시 실패', () => {
  const bad = structuredClone(GOOD);
  bad.main_narrative.paragraph_1_who_you_are += ' 표현의 기운이 강해요.';
  assert.ok(hasHardTotalReviewViolation(bad), '표현의 기운은 hard 위반');
});

test('validateTotalReview: "결과" 같은 복합어는 오탐 없이 통과', () => {
  const ok = structuredClone(GOOD);
  ok.main_narrative.paragraph_3_weak_zone += ' 이게 누적되면 지치는 결과로 이어져요.';
  const r = validateTotalReview(ok, CTX);
  assert.ok(
    !r.reasons.some((x) => x.includes('어휘 정책')),
    `"결과"는 오탐이면 안 됨: ${r.reasons.join(' / ')}`
  );
});
