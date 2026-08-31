import assert from 'node:assert/strict';
import {
  TOTAL_REVIEW_MAX_OUTPUT_TOKENS,
  TOTAL_REVIEW_TIMEOUT_MS,
} from '../saju-total-review-service';

// 2026-08-31 — 프로덕션 실측으로 정한 하한. 근거는 saju-total-review-service.ts 상수 주석.
//   내리면 "성공의 12% 가 상한에서 잘리고, 성공의 p90 이 타임아웃 벽에 붙는" 상태로 돌아간다.

declare const test: (name: string, fn: () => void | Promise<void>) => void;

test('총평 출력 상한 — 본문 4단락(28~32문장)이 들어가는 크기', () => {
  assert.ok(
    TOTAL_REVIEW_MAX_OUTPUT_TOKENS >= 2400,
    `1500 은 실측 12% 잘림. 프롬프트 길이 규칙(28~32문장)을 줄이지 않는 한 2400 아래로 내리지 말 것 (현재 ${TOTAL_REVIEW_MAX_OUTPUT_TOKENS})`
  );
});

test('총평 타임아웃 — 성공 p90(14s)·상한 인상분을 감안한 여유', () => {
  assert.ok(
    TOTAL_REVIEW_TIMEOUT_MS >= 30_000,
    `15s 기본값은 성공 호출 max 14.9s 와 겹쳤다(실패 전부 15.0s 절단). 현재 ${TOTAL_REVIEW_TIMEOUT_MS}`
  );
});
