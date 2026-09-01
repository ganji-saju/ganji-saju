// 2026-09-01 — 설정 화면이 "알림톡으로 받을 수 있어요" 라는 약속을 언제 보여줄지 결정하는
//   단 하나의 게이트. 이게 느슨하면 **못 지키는 약속으로 휴대폰 번호를 수집**하게 된다
//   (실제로 프로덕션에서 34건 수집 / 발송 0건이 났다).
import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

async function loadConfig() {
  return import('./config');
}

describe('isKakaoAlimtalkLive', () => {
  it('키가 다 있어도 승인 템플릿 코드가 없으면 false — 발송 트리거가 코드로 게이트된다', async () => {
    vi.stubEnv('SOLAPI_API_KEY', 'k');
    vi.stubEnv('SOLAPI_API_SECRET', 's');
    vi.stubEnv('SOLAPI_KAKAO_PFID', 'pf');
    vi.stubEnv('KAKAO_TPL_PAYMENT_COMPLETE', '');
    const { isKakaoAlimtalkLive, isKakaoSendConfigured } = await loadConfig();
    expect(isKakaoSendConfigured()).toBe(true); // 키만 보면 통과했다
    expect(isKakaoAlimtalkLive()).toBe(false); // 🔴 그런데 실제로는 한 건도 못 나간다
  });

  it('템플릿 코드가 있어도 발송 키가 없으면 false', async () => {
    vi.stubEnv('SOLAPI_API_KEY', '');
    vi.stubEnv('SOLAPI_API_SECRET', '');
    vi.stubEnv('SOLAPI_KAKAO_PFID', '');
    vi.stubEnv('KAKAO_TPL_PAYMENT_COMPLETE', 'TPL_1');
    const { isKakaoAlimtalkLive } = await loadConfig();
    expect(isKakaoAlimtalkLive()).toBe(false);
  });

  it('키 + 템플릿이 모두 있을 때만 true', async () => {
    vi.stubEnv('SOLAPI_API_KEY', 'k');
    vi.stubEnv('SOLAPI_API_SECRET', 's');
    vi.stubEnv('SOLAPI_KAKAO_PFID', 'pf');
    vi.stubEnv('KAKAO_TPL_PAYMENT_COMPLETE', 'TPL_1');
    const { isKakaoAlimtalkLive } = await loadConfig();
    expect(isKakaoAlimtalkLive()).toBe(true);
  });

  it('아무것도 설정 안 된 기본 상태는 false(약속을 보이지 않는다)', async () => {
    vi.stubEnv('SOLAPI_API_KEY', '');
    vi.stubEnv('SOLAPI_API_SECRET', '');
    vi.stubEnv('SOLAPI_KAKAO_PFID', '');
    vi.stubEnv('KAKAO_TPL_PAYMENT_COMPLETE', '');
    const { isKakaoAlimtalkLive } = await loadConfig();
    expect(isKakaoAlimtalkLive()).toBe(false);
  });
});
