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

function isProduction(): boolean {
  // Vercel preview / development 빌드는 본 가드 비활성 (개발 방해 X).
  if (process.env.NODE_ENV !== 'production') return false;
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') return false;
  return true;
}

function getEnv(key: string): string {
  const raw = process.env[key];
  return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * production 환경에서 필수 env 가 누락된 경우 throw.
 * import 시점 (build / SSR boot) 에 자동 실행 — 누락 시 즉시 차단.
 */
export function assertProductionBusinessEnv(): void {
  if (!isProduction()) return;
  const missing = REQUIRED_PRODUCTION_KEYS.filter(([key]) => !getEnv(key));
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

// import 시점 자동 검증 — production build / SSR boot 단계에서 누락 검출.
assertProductionBusinessEnv();

/**
 * typed 사업자 정보 export.
 *
 * production: 모든 required 값이 채워짐 (가드 통과).
 * dev / preview: 비어 있을 수 있음 — UI 는 빈 문자열 표기 (placeholder 절대 금지 = 사용자 directive).
 */
export const BUSINESS_INFO = {
  companyName: getEnv('NEXT_PUBLIC_COMPANY_NAME'),
  ceoName: getEnv('NEXT_PUBLIC_CEO_NAME'),
  businessRegistrationNumber: getEnv('NEXT_PUBLIC_BUSINESS_REGISTRATION_NUMBER'),
  mailOrderRegistrationNumber: getEnv('NEXT_PUBLIC_MAIL_ORDER_REGISTRATION_NUMBER'),
  address: getEnv('NEXT_PUBLIC_BUSINESS_ADDRESS'),
  phone: getEnv('NEXT_PUBLIC_CS_PHONE'),
  email: getEnv('NEXT_PUBLIC_CS_EMAIL'),
  csHours: getEnv('NEXT_PUBLIC_CS_HOURS'),
  privacyOfficerName: getEnv('NEXT_PUBLIC_PRIVACY_OFFICER_NAME'),
  privacyOfficerEmail: getEnv('NEXT_PUBLIC_PRIVACY_OFFICER_EMAIL'),
  // 선택값: 비어 있으면 phone fallback 으로 사용 (UI 처리).
  privacyOfficerPhone: getEnv('NEXT_PUBLIC_PRIVACY_OFFICER_PHONE'),
  // 선택값: 사업자정보 공시 URL (없으면 푸터에 링크 미표시).
  businessInfoVerificationUrl: getEnv('NEXT_PUBLIC_BUSINESS_INFO_VERIFICATION_URL'),
} as const;

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
