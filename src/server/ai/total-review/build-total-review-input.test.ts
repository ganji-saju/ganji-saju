import assert from 'node:assert/strict';
import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { buildSajuPersonalizationContext } from '@/domain/saju/report/personalization-context';
import { buildTotalReviewInput } from './build-total-review-input';

// 2026-05-21 — _easy 도출 빌더 검증. 엔진 계산값이 아닌 *구조 불변식* 을 단언
//   (일주/격국 결과는 calendar 계산에 의존하므로 결합 회피). spec §5 케이스 입력.

declare const test: (name: string, fn: () => void | Promise<void>) => void;

function buildFixture() {
  // 1999-04-01 14:30 여 (spec §5: 계미 일주 / 식신격 / 신약 / 용신 금 케이스)
  const data = calculateSajuDataV1({
    year: 1999,
    month: 4,
    day: 1,
    hour: 14,
    gender: 'female',
  });
  const ctx = buildSajuPersonalizationContext(data, {
    relationshipStatus: 'married',
    occupation: 'employee',
    currentConcern: 'wealth',
    concernNote: null,
  });
  return { data, ctx };
}

test('buildTotalReviewInput: key_strengths_easy / key_weaknesses_easy 를 정확히 3개씩 만든다', () => {
  const { data, ctx } = buildFixture();
  const input = buildTotalReviewInput(data, ctx, {
    userName: '간지사주 테스트',
    gender: 'F',
    now: new Date('2026-05-21T00:00:00Z'),
  });
  assert.equal(input.wonkuk.key_strengths_easy.length, 3, '강점 3개');
  assert.equal(input.wonkuk.key_weaknesses_easy.length, 3, '약점 3개');
});

test('buildTotalReviewInput: wonkuk/current_timeline 에 한자 0건', () => {
  const { data, ctx } = buildFixture();
  const input = buildTotalReviewInput(data, ctx, { userName: '테스트' });
  const wonkukJson = JSON.stringify(input.wonkuk);
  const timelineJson = JSON.stringify(input.current_timeline);
  assert.ok(!/[一-鿿]/.test(wonkukJson), `wonkuk 한자 노출: ${wonkukJson.match(/[一-鿿]+/)?.[0]}`);
  assert.ok(!/[一-鿿]/.test(timelineJson), `timeline 한자 노출: ${timelineJson.match(/[一-鿿]+/)?.[0]}`);
});

test('buildTotalReviewInput: context enum 을 한글 라벨로 매핑 (married→기혼, employee→직장인, wealth→재물·투자)', () => {
  const { data, ctx } = buildFixture();
  const input = buildTotalReviewInput(data, ctx, {});
  assert.equal(input.context.relationship_status, '기혼');
  assert.equal(input.context.occupation_status, '직장인');
  assert.equal(input.context.concern, '재물·투자');
});

test('buildTotalReviewInput: 격국이 있으면 career_fit 을 채운다', () => {
  const { data, ctx } = buildFixture();
  const input = buildTotalReviewInput(data, ctx, {});
  assert.ok(Array.isArray(input.wonkuk.kyeokguk_easy.career_fit));
  if (input.wonkuk.kyeokguk_easy.label) {
    assert.ok(
      input.wonkuk.kyeokguk_easy.career_fit.length > 0,
      `격국(${input.wonkuk.kyeokguk_easy.label}) 있는데 career_fit 비어있음`
    );
  }
});

test('buildTotalReviewInput: daewoon 은 현재 시기로 표시', () => {
  const { data, ctx } = buildFixture();
  const input = buildTotalReviewInput(data, ctx, {});
  assert.equal(input.current_timeline.daewoon.is_current, true);
  assert.ok(input.current_timeline.daewoon.meaning_easy.length > 0);
});

test('buildTotalReviewInput: ohaeng_balance 는 5 오행 키를 모두 가진다', () => {
  const { data, ctx } = buildFixture();
  const input = buildTotalReviewInput(data, ctx, {});
  for (const element of ['목', '화', '토', '금', '수']) {
    assert.ok(element in input.wonkuk.ohaeng_balance, `${element} 키 누락`);
  }
});
