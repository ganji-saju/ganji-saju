// 2026-09-14 — PG 취소 때 회수할 전은 결제가 실제로 지급한 전과 같아야 한다(지급과 대칭).
//   대화상담 질문 3회는 카탈로그 credits=0 인데 전 3개를 줘서 취소해도 회수가 0이었다(사용자 요청: 3개 회수).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getPackage } from './catalog';
import { creditsToRevokeOnCancel, DIALOGUE_QUESTION_CREDITS } from './coin-sunset';

declare const test: (name: string, fn: () => void) => void;

test('취소 회수 전 = 지급한 전 — 대화상담 3 · 멤버십 0(sunset 뒤 미지급) · 이용권 단품 0 · 전 충전은 카탈로그', () => {
  assert.equal(creditsToRevokeOnCancel(getPackage('taste_dialogue_entry')), 3);
  assert.equal(creditsToRevokeOnCancel(getPackage('membership_premium')), 0);
  assert.equal(creditsToRevokeOnCancel(getPackage('taste_today_detail')), 0);
  const creditPack = getPackage('credit_15');
  if (creditPack) assert.equal(creditsToRevokeOnCancel(creditPack), creditPack.credits);
  assert.equal(creditsToRevokeOnCancel(undefined), 0);
});

test('지급도 같은 상수를 쓴다 — 한쪽만 바꾸면 회수가 어긋난다', () => {
  assert.equal(DIALOGUE_QUESTION_CREDITS, 3);
  const fulfillment = fs.readFileSync(path.resolve(__dirname, 'fulfillment.ts'), 'utf8');
  assert.ok(/addCredits\(claimed\.userId, DIALOGUE_QUESTION_CREDITS, 'purchase'/.test(fulfillment));
});
