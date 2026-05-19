/**
 * 사업자 정보 — Phase 3-A (2026-05-18).
 *
 * 모든 값은 NEXT_PUBLIC_ env 기반 (클라이언트 노출, 비밀 아님). production 배포 시
 * 필수 항목이 비어 있으면 build throw → 배포 차단.
 *
 * 사용처:
 *   - src/components/site-footer.tsx (사업자 정보 + CS 연락처)
 *   - src/app/help/page.tsx (회사 정보)
 *   - src/app/(public)/legal/* (정책 페이지 — Phase 3-B 신설 예정)
 *   - src/app/commerce-disclosure/page.tsx (Phase 3-B)
 *
 * 운영자 후속:
 *   1. Vercel 대시보드 Settings → Environment Variables 에 NEXT_PUBLIC_* 값 입력
 *   2. production deploy → env-guard 가 누락값 검출 시 build fail
 *   3. docs/legal-required-fields.md §5 체크리스트 갱신
 */

/**
 * production 환경에서 비어 있으면 build throw 하는 필수 env.
 * 누락 시 사이트가 사업자 정보를 표시하지 못해 전자상거래법 §13 위반 가능.
 */
const REQUIRED_PRODUCTION_KEYS = [
  ['NEXT_PUBLIC_COMPANY_NAME', '회사명'],
  ['NEXT_PUBLIC_CEO_NAME', '대표자명'],
  ['NEXT_PUBLIC_BUSINESS_REGISTRATION_NUMBER', '사업자등록번호'],
  ['NEXT_PUBLIC_MAIL_ORDER_REGISTRATION_NUMBER', '통신판매업 신고번호'],
  ['NEXT_PUBLIC_BUSINESS_ADDRESS', '사업장 주소'],
  ['NEXT_PUBLIC_CS_PHONE', '고객센터 전화번호'],
  ['NEXT_PUBLIC_CS_EMAIL', '고객센터 이메일'],
  ['NEXT_PUBLIC_CS_HOURS', '고객센터 운영시간'],
  ['NEXT_PUBLIC_PRIVACY_OFFICER_NAME', '개인정보보호책임자 성명'],
  ['NEXT_PUBLIC_PRIVACY_OFFICER_EMAIL', '개인정보보호책임자 이메일'],
] as const;

function isProductionDeploy(): boolean {
  // Vercel **production deploy** 만 가드 활성. 즉 실제 사용자가 보는 배포만 검증.
  //   - 로컬 npm run build: VERCEL_ENV undefined → 비활성 (개발 방해 X)
  //   - CI build (GitHub Actions): VERCEL_ENV undefined → 비활성 (CI 차단 X)
  //   - Vercel preview: VERCEL_ENV='preview' → 비활성 (PR preview 차단 X)
  //   - Vercel production: VERCEL_ENV='production' → 활성 (사이트 노출 차단)
  return process.env.VERCEL_ENV === 'production';
}

/**
 * 2026-05-20 — Hydration mismatch fix:
 *   기존 getEnv(key: string) 는 process.env[key] 동적 접근 사용 →
 *   Webpack/Turbopack 의 NEXT_PUBLIC_* inline 이 정적 접근 (process.env.X) 만
 *   지원하므로 client 번들에서는 undefined 가 됐다.
 *   server: 실제 env 값 / client: undefined → SSR ↔ CSR HTML 불일치 (SiteFooter dl).
 *   해결: 각 키를 정적으로 직접 접근 — 빌드 타임에 client 번들에 inline 보장.
 */
function readEnv(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * production 환경에서 필수 env 가 누락된 경우 throw.
 * import 시점 (build / SSR boot) 에 자동 실행 — 누락 시 즉시 차단.
 */
export function assertProductionBusinessEnv(): void {
  if (!isProductionDeploy()) return;
  // server 전용 검증 — 정적 객체 BUSINESS_INFO 의 값 직접 확인.
  const missing = REQUIRED_PRODUCTION_KEYS.filter(([key]) => {
    const value = BUSINESS_INFO[ENV_KEY_TO_FIELD[key]];
    return !value;
  });
  if (missing.length === 0) return;

  const lines = missing.map(([key, label]) => `  - ${key} (${label})`);
  throw new Error(
    [
      '[business-info] production 빌드 차단 — 필수 사업자 정보 env 누락:',
      ...lines,
      '',
      '운영자: Vercel 대시보드 → Settings → Environment Variables 에 위 키를 입력 후 재배포하세요.',
      'docs/legal-required-fields.md §3 참고.',
    ].join('\n')
  );
}

/**
 * typed 사업자 정보 export.
 *
 * production: 모든 required 값이 채워짐 (가드 통과).
 * dev / preview: 비어 있을 수 있음 — UI 는 빈 문자열 표기 (placeholder 절대 금지 = 사용자 directive).
 *
 * 2026-05-20 fix: process.env.NEXT_PUBLIC_* 정적 접근으로 client 번들에 inline 보장.
 */
export const BUSINESS_INFO = {
  companyName: readEnv(process.env.NEXT_PUBLIC_COMPANY_NAME),
  ceoName: readEnv(process.env.NEXT_PUBLIC_CEO_NAME),
  businessRegistrationNumber: readEnv(process.env.NEXT_PUBLIC_BUSINESS_REGISTRATION_NUMBER),
  mailOrderRegistrationNumber: readEnv(process.env.NEXT_PUBLIC_MAIL_ORDER_REGISTRATION_NUMBER),
  address: readEnv(process.env.NEXT_PUBLIC_BUSINESS_ADDRESS),
  phone: readEnv(process.env.NEXT_PUBLIC_CS_PHONE),
  email: readEnv(process.env.NEXT_PUBLIC_CS_EMAIL),
  csHours: readEnv(process.env.NEXT_PUBLIC_CS_HOURS),
  privacyOfficerName: readEnv(process.env.NEXT_PUBLIC_PRIVACY_OFFICER_NAME),
  privacyOfficerEmail: readEnv(process.env.NEXT_PUBLIC_PRIVACY_OFFICER_EMAIL),
  // 선택값: 비어 있으면 phone fallback 으로 사용 (UI 처리).
  privacyOfficerPhone: readEnv(process.env.NEXT_PUBLIC_PRIVACY_OFFICER_PHONE),
  // 선택값: 사업자정보 공시 URL (없으면 푸터에 링크 미표시).
  businessInfoVerificationUrl: readEnv(process.env.NEXT_PUBLIC_BUSINESS_INFO_VERIFICATION_URL),
} as const;

/** assertProductionBusinessEnv 가 REQUIRED_PRODUCTION_KEYS 의 env key 를 BUSINESS_INFO field 로 매핑. */
const ENV_KEY_TO_FIELD = {
  NEXT_PUBLIC_COMPANY_NAME: 'companyName',
  NEXT_PUBLIC_CEO_NAME: 'ceoName',
  NEXT_PUBLIC_BUSINESS_REGISTRATION_NUMBER: 'businessRegistrationNumber',
  NEXT_PUBLIC_MAIL_ORDER_REGISTRATION_NUMBER: 'mailOrderRegistrationNumber',
  NEXT_PUBLIC_BUSINESS_ADDRESS: 'address',
  NEXT_PUBLIC_CS_PHONE: 'phone',
  NEXT_PUBLIC_CS_EMAIL: 'email',
  NEXT_PUBLIC_CS_HOURS: 'csHours',
  NEXT_PUBLIC_PRIVACY_OFFICER_NAME: 'privacyOfficerName',
  NEXT_PUBLIC_PRIVACY_OFFICER_EMAIL: 'privacyOfficerEmail',
} as const satisfies Record<string, keyof typeof BUSINESS_INFO>;

// import 시점 자동 검증 — production build / SSR boot 단계에서 누락 검출.
//   BUSINESS_INFO 정의 이후 호출 (위 객체 / 매핑 표 의존성).
assertProductionBusinessEnv();

export type BusinessInfo = typeof BUSINESS_INFO;

/**
 * 운영시간 / 연락처 합산 카피 (CS 안내 영역용).
 */
export function getCsContactLine(): string {
  const parts: string[] = [];
  if (BUSINESS_INFO.email) parts.push(BUSINESS_INFO.email);
  if (BUSINESS_INFO.phone) parts.push(BUSINESS_INFO.phone);
  if (BUSINESS_INFO.csHours) parts.push(BUSINESS_INFO.csHours);
  return parts.join(' · ');
}

/**
 * 개인정보보호책임자 연락처 (전화 없으면 CS 전화 fallback).
 */
export function getPrivacyOfficerContact(): {
  name: string;
  email: string;
  phone: string;
} {
  return {
    name: BUSINESS_INFO.privacyOfficerName,
    email: BUSINESS_INFO.privacyOfficerEmail,
    phone: BUSINESS_INFO.privacyOfficerPhone || BUSINESS_INFO.phone,
  };
}
