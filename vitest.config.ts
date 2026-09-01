// 2026-05-14: saju-data/v2 회귀 테스트용 vitest 설정.
// - alias @/ → src/
// - 기존 *.test.ts (run-unit-tests.mjs 가 사용) 와 충돌 회피를 위해 *.spec.ts 만 수집한다.
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // 서버 전용 모듈도 단위 테스트할 수 있게 한다 — 'server-only' 는 번들 가드일 뿐
      //   런타임 동작이 없어 no-op 로 대체해도 검증 내용이 달라지지 않는다.
      'server-only': path.resolve(__dirname, 'test/server-only-stub.ts'),
    },
  },
  test: {
    // 2026-08-11 — 전면 유료화 잠금은 프로덕션 기본 ON 이지만, 기존 스펙은 **잠금 이전 제품**을
    //   검증한다. 여기서 OFF 로 고정해 복원 시 안전망을 유지하고, 잠금 동작 자체는
    //   src/lib/paywall-lockdown.spec.ts 가 env 를 직접 켜서 검증한다.
    env: { NEXT_PUBLIC_PAYWALL_LOCKDOWN: 'false' },
    environment: 'node',
    include: ['src/**/*.spec.ts', 'src/**/*.test.tsx'],
    // 기존 .test.ts 는 scripts/run-unit-tests.mjs 에서 별도 실행.
    exclude: ['node_modules', '.next', 'dist', 'src/**/*.test.ts'],
  },
});
