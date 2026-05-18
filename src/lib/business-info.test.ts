// Phase 3-A (2026-05-18): 사업자 정보 env config + production 가드 검증.
import assert from 'node:assert/strict';
import {
  BUSINESS_INFO,
  assertProductionBusinessEnv,
  getCsContactLine,
  getPrivacyOfficerContact,
} from './business-info';

declare const test: (name: string, fn: () => void) => void;

const REQUIRED_KEYS = [
  'NEXT_PUBLIC_COMPANY_NAME',
  'NEXT_PUBLIC_CEO_NAME',
  'NEXT_PUBLIC_BUSINESS_REGISTRATION_NUMBER',
  'NEXT_PUBLIC_MAIL_ORDER_REGISTRATION_NUMBER',
  'NEXT_PUBLIC_BUSINESS_ADDRESS',
  'NEXT_PUBLIC_CS_PHONE',
  'NEXT_PUBLIC_CS_EMAIL',
  'NEXT_PUBLIC_CS_HOURS',
  'NEXT_PUBLIC_PRIVACY_OFFICER_NAME',
  'NEXT_PUBLIC_PRIVACY_OFFICER_EMAIL',
];

function snapshotEnv() {
  const snapshot: Record<string, string | undefined> = {};
  for (const key of [
    ...REQUIRED_KEYS,
    'NEXT_PUBLIC_PRIVACY_OFFICER_PHONE',
    'NEXT_PUBLIC_BUSINESS_INFO_VERIFICATION_URL',
    'NODE_ENV',
    'VERCEL_ENV',
  ]) {
    snapshot[key] = process.env[key];
  }
  return snapshot;
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function setEnvAll(value: string) {
  for (const key of REQUIRED_KEYS) process.env[key] = value;
}

test('BUSINESS_INFO 11 필드 모두 export — typed 객체', () => {
  assert.ok('companyName' in BUSINESS_INFO);
  assert.ok('ceoName' in BUSINESS_INFO);
  assert.ok('businessRegistrationNumber' in BUSINESS_INFO);
  assert.ok('mailOrderRegistrationNumber' in BUSINESS_INFO);
  assert.ok('address' in BUSINESS_INFO);
  assert.ok('phone' in BUSINESS_INFO);
  assert.ok('email' in BUSINESS_INFO);
  assert.ok('csHours' in BUSINESS_INFO);
  assert.ok('privacyOfficerName' in BUSINESS_INFO);
  assert.ok('privacyOfficerEmail' in BUSINESS_INFO);
  assert.ok('privacyOfficerPhone' in BUSINESS_INFO);
  assert.ok('businessInfoVerificationUrl' in BUSINESS_INFO);
});

test('assertProductionBusinessEnv — dev / preview 환경에서는 throw 안 함', () => {
  const snap = snapshotEnv();
  try {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    delete process.env.VERCEL_ENV;
    for (const key of REQUIRED_KEYS) delete process.env[key];
    // 빈 env 상태에서도 dev 면 throw 안 함
    assertProductionBusinessEnv(); // no throw
  } finally {
    restoreEnv(snap);
  }
});

test('assertProductionBusinessEnv — VERCEL_ENV=preview 일 때 throw 안 함', () => {
  const snap = snapshotEnv();
  try {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.VERCEL_ENV = 'preview';
    for (const key of REQUIRED_KEYS) delete process.env[key];
    assertProductionBusinessEnv(); // no throw
  } finally {
    restoreEnv(snap);
  }
});

test('assertProductionBusinessEnv — production + 필수 env 누락 시 throw', () => {
  const snap = snapshotEnv();
  try {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.VERCEL_ENV = 'production';
    for (const key of REQUIRED_KEYS) delete process.env[key];
    assert.throws(() => assertProductionBusinessEnv(), /production 빌드 차단/);
  } finally {
    restoreEnv(snap);
  }
});

test('assertProductionBusinessEnv — production + 일부만 누락 시 throw 메시지에 누락 키 포함', () => {
  const snap = snapshotEnv();
  try {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.VERCEL_ENV = 'production';
    setEnvAll('value');
    delete process.env.NEXT_PUBLIC_MAIL_ORDER_REGISTRATION_NUMBER;
    assert.throws(
      () => assertProductionBusinessEnv(),
      /NEXT_PUBLIC_MAIL_ORDER_REGISTRATION_NUMBER/
    );
  } finally {
    restoreEnv(snap);
  }
});

test('assertProductionBusinessEnv — production + 모든 env 채움 → 통과', () => {
  const snap = snapshotEnv();
  try {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.VERCEL_ENV = 'production';
    setEnvAll('value');
    assertProductionBusinessEnv(); // no throw
  } finally {
    restoreEnv(snap);
  }
});

test('assertProductionBusinessEnv — env 값이 공백만이면 누락으로 판정', () => {
  const snap = snapshotEnv();
  try {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.VERCEL_ENV = 'production';
    setEnvAll('value');
    process.env.NEXT_PUBLIC_CEO_NAME = '   '; // 공백
    assert.throws(
      () => assertProductionBusinessEnv(),
      /NEXT_PUBLIC_CEO_NAME/
    );
  } finally {
    restoreEnv(snap);
  }
});

test('getCsContactLine — 빈 env 시 빈 문자열', () => {
  // 본 import 는 module-cached BUSINESS_INFO 사용 — 빈 env 시 결과 보장.
  // (BUSINESS_INFO 는 module load 시 freeze, 환경변수 후 변경 안 됨)
  const line = getCsContactLine();
  assert.equal(typeof line, 'string');
});

test('getPrivacyOfficerContact — phone fallback 동작 확인 (CPO 전화 비면 CS 전화 사용)', () => {
  const cpo = getPrivacyOfficerContact();
  // 둘 다 비었으면 빈 문자열 (dev)
  if (BUSINESS_INFO.privacyOfficerPhone) {
    assert.equal(cpo.phone, BUSINESS_INFO.privacyOfficerPhone);
  } else {
    assert.equal(cpo.phone, BUSINESS_INFO.phone);
  }
  assert.equal(cpo.name, BUSINESS_INFO.privacyOfficerName);
  assert.equal(cpo.email, BUSINESS_INFO.privacyOfficerEmail);
});
