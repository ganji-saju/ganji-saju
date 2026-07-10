// 2026-07-10 — 나이스페이 키 짝(pair) 감사 가드.
//
// 배경: 2026-06-27 19:25~20:23 KST 에 승인 4건이 나이스페이 resultMsg
//   "사용자 정보가 존재하지 않습니다." 로 실패했다. 같은 날 18:06 에 모드별 키 이름
//   (NICEPAY_LIVE_SECRET_KEY 등)을 도입했는데, nicepay-env/getSecretKey 는 모드별 키가
//   없으면 **조용히 공용 키로 폴백**한다. clientKey 와 secretKey 가 각각 독립 폴백하므로
//   'live clientKey + 공용(샌드박스) secretKey' 같은 짝 불일치가 경고 없이 만들어진다.
//
// 이 테스트는 그 짝 불일치를 감지하는 감사 함수를 고정한다.
import assert from 'node:assert/strict';
import { auditNicepayKeyPair } from './nicepay-config-audit';

declare const test: (name: string, fn: () => void) => void;

const ENV_KEYS = [
  'NEXT_PUBLIC_NICEPAY_MODE',
  'NICEPAY_API_BASE',
  'NEXT_PUBLIC_NICEPAY_CLIENT_KEY',
  'NEXT_PUBLIC_NICEPAY_SANDBOX_CLIENT_KEY',
  'NEXT_PUBLIC_NICEPAY_LIVE_CLIENT_KEY',
  'NICEPAY_SECRET_KEY',
  'NICEPAY_SANDBOX_SECRET_KEY',
  'NICEPAY_LIVE_SECRET_KEY',
] as const;

function withEnv(patch: Record<string, string | undefined>, fn: () => void) {
  const saved = new Map<string, string | undefined>();
  for (const k of ENV_KEYS) saved.set(k, process.env[k]);
  try {
    for (const k of ENV_KEYS) delete process.env[k];
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) process.env[k] = v;
    }
    fn();
  } finally {
    for (const [k, v] of saved) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test('짝 일치: live 모드 + live clientKey + live secretKey → ok', () => {
  withEnv(
    {
      NEXT_PUBLIC_NICEPAY_MODE: 'live',
      NEXT_PUBLIC_NICEPAY_LIVE_CLIENT_KEY: 'R2_liveclient',
      NICEPAY_LIVE_SECRET_KEY: 'livesecret',
    },
    () => {
      const audit = auditNicepayKeyPair();
      assert.equal(audit.mode, 'live');
      assert.equal(audit.clientKeySource, 'mode');
      assert.equal(audit.secretKeySource, 'mode');
      assert.equal(audit.ok, true);
      assert.deepEqual(audit.problems, []);
    }
  );
});

test('짝 불일치: live clientKey(모드별) + 공용 secretKey(폴백) → 경고', () => {
  withEnv(
    {
      NEXT_PUBLIC_NICEPAY_MODE: 'live',
      NEXT_PUBLIC_NICEPAY_LIVE_CLIENT_KEY: 'R2_liveclient',
      NICEPAY_SECRET_KEY: 'sharedsecret',
    },
    () => {
      const audit = auditNicepayKeyPair();
      assert.equal(audit.clientKeySource, 'mode');
      assert.equal(audit.secretKeySource, 'fallback');
      assert.equal(audit.ok, false, '한쪽만 모드별이면 다른 가맹점 키가 섞일 수 있다');
      assert.ok(
        audit.problems.some((p) => p.code === 'key_source_mismatch'),
        'key_source_mismatch 를 보고해야 한다'
      );
    }
  );
});

test('clientKey 접두사가 모드와 어긋나면 경고 (R2_=live, S2_=sandbox)', () => {
  withEnv(
    {
      NEXT_PUBLIC_NICEPAY_MODE: 'sandbox',
      NEXT_PUBLIC_NICEPAY_SANDBOX_CLIENT_KEY: 'R2_liveclient',
      NICEPAY_SANDBOX_SECRET_KEY: 'sandboxsecret',
    },
    () => {
      const audit = auditNicepayKeyPair();
      assert.equal(audit.ok, false);
      assert.ok(audit.problems.some((p) => p.code === 'client_key_prefix_mismatch'));
    }
  );
});

test('NICEPAY_API_BASE 가 모드와 다른 호스트를 덮어쓰면 경고', () => {
  withEnv(
    {
      NEXT_PUBLIC_NICEPAY_MODE: 'live',
      NICEPAY_API_BASE: 'https://sandbox-api.nicepay.co.kr',
      NEXT_PUBLIC_NICEPAY_LIVE_CLIENT_KEY: 'R2_liveclient',
      NICEPAY_LIVE_SECRET_KEY: 'livesecret',
    },
    () => {
      const audit = auditNicepayKeyPair();
      assert.equal(audit.ok, false);
      assert.ok(audit.problems.some((p) => p.code === 'api_base_mode_mismatch'));
    }
  );
});

test('감사 결과는 secretKey 값을 절대 노출하지 않는다', () => {
  withEnv(
    {
      NEXT_PUBLIC_NICEPAY_MODE: 'live',
      NEXT_PUBLIC_NICEPAY_LIVE_CLIENT_KEY: 'R2_liveclient',
      NICEPAY_LIVE_SECRET_KEY: 'super-secret-value',
    },
    () => {
      const serialized = JSON.stringify(auditNicepayKeyPair());
      assert.ok(!serialized.includes('super-secret-value'), 'secretKey 원문이 새면 안 된다');
      assert.ok(serialized.includes('R2_'), 'clientKey 접두사는 진단에 필요(공개값)');
    }
  );
});

test('키가 아예 없으면 missing 으로 보고하고 throw 하지 않는다', () => {
  withEnv({ NEXT_PUBLIC_NICEPAY_MODE: 'live' }, () => {
    const audit = auditNicepayKeyPair();
    assert.equal(audit.clientKeySource, 'missing');
    assert.equal(audit.secretKeySource, 'missing');
    assert.equal(audit.ok, false);
  });
});
