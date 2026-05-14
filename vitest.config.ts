// 2026-05-14: saju-data/v2 회귀 테스트용 vitest 설정.
// - alias @/ → src/
// - 기존 *.test.ts (run-unit-tests.mjs 가 사용) 와 충돌 회피를 위해 *.spec.ts 만 수집한다.
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    // 기존 .test.ts 는 scripts/run-unit-tests.mjs 에서 별도 실행.
    exclude: ['node_modules', '.next', 'dist', 'src/**/*.test.ts'],
  },
});
