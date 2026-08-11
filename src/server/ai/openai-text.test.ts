import assert from 'node:assert/strict';
import {
  getOpenAIInterpretationModel,
  getOpenAIModel,
} from './openai-text';

declare const test: (name: string, fn: () => void) => void;

function withEnv(key: string, value: string | undefined, fn: () => void) {
  const previous = process.env[key];

  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }

  try {
    fn();
  } finally {
    if (previous === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = previous;
    }
  }
}

test('모델 기본값은 대화·해석 모두 gpt-5.6-luna (Responses API 실측 확인분)', () => {
  withEnv('OPENAI_MODEL', undefined, () => {
    withEnv('OPENAI_INTERPRET_MODEL', undefined, () => {
      assert.equal(getOpenAIModel(), 'gpt-5.6-luna');
      assert.equal(getOpenAIInterpretationModel(), 'gpt-5.6-luna');
    });
  });
});

test('OpenAI env overrides still take precedence when explicitly provided', () => {
  withEnv('OPENAI_MODEL', 'gpt-5.2', () => {
    withEnv('OPENAI_INTERPRET_MODEL', 'gpt-5.2', () => {
      assert.equal(getOpenAIModel(), 'gpt-5.2');
      assert.equal(getOpenAIInterpretationModel(), 'gpt-5.2');
    });
  });
});

// 2026-08-11 회귀 가드 — Responses API 는 *-chat-latest 별칭을 서빙하지 않는다.
//   기본값에 넣으면 전 LLM 기능이 404 로 죽는다(2026-08-10~11 장애 원인).
test('기본 모델에 -chat-latest 별칭을 쓰지 않는다 (Responses API 404)', () => {
  withEnv('OPENAI_MODEL', undefined, () => {
    withEnv('OPENAI_INTERPRET_MODEL', undefined, () => {
      for (const model of [getOpenAIModel(), getOpenAIInterpretationModel()]) {
        assert.ok(
          !model.endsWith('-chat-latest'),
          `기본 모델 '${model}' 은 Responses API 에서 404 가 난다`
        );
      }
    });
  });
});
