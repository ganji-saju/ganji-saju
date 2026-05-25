import assert from 'node:assert/strict';
import { feedbackSaveErrorResponse } from './route-helpers';

declare const test: (name: string, fn: () => void) => void;

test('DB 저장 실패 시 raw 오류를 클라이언트에 노출하지 않고 한국어 안내로 대체한다', () => {
  const raw = "Could not find the table 'public.today_fortune_feedback' in the schema cache";
  const res = feedbackSaveErrorResponse(raw);
  assert.equal(res.status, 500);
  assert.equal(res.body.ok, false);
  // raw DB/PostgREST 메시지(내부 테이블명·스키마 정보)가 클라이언트로 새지 않아야 한다.
  assert.ok(!res.body.error.includes('schema cache'), 'raw 오류 문구가 그대로 노출됨');
  assert.ok(!res.body.error.includes('today_fortune_feedback'), '내부 테이블명이 노출됨');
  // 사용자에게는 한국어 안내 문구만 노출.
  assert.match(res.body.error, /피드백/);
  // raw 오류는 서버 로그용으로 보존(클라이언트 body 와는 분리).
  assert.equal(res.logError, raw);
});

test('rawError 가 undefined 여도 한국어 안내 메시지를 반환한다', () => {
  const res = feedbackSaveErrorResponse(undefined);
  assert.equal(res.status, 500);
  assert.equal(res.body.ok, false);
  assert.match(res.body.error, /피드백/);
});
