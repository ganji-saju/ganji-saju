import assert from 'node:assert/strict';
import { shouldShowAiDisclosure } from './ai-disclosure';

// 배지 노출: LLM 텍스트가 실제 사용된 경우
assert.equal(shouldShowAiDisclosure('openai'), true, "'openai' should show disclosure");
assert.equal(shouldShowAiDisclosure('cache'), true, "'cache' should show disclosure");

// 배지 없음: 결정론 경로 또는 미설정
assert.equal(shouldShowAiDisclosure('fallback'), false, "'fallback' should not show disclosure");
assert.equal(shouldShowAiDisclosure(undefined), false, "undefined should not show disclosure");
assert.equal(shouldShowAiDisclosure(''), false, "empty string should not show disclosure");

console.log('ai-disclosure: all 5 assertions passed');
