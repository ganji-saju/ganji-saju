// 2026-08-31 — 어드민 유료상품 권한 수동 부여 정의.
//
//   그동안 관리자가 줄 수 있던 건 전 · 멤버십 · 평생리포트 셋뿐이라, 나머지 유료 메뉴는
//   보상·CS 대응이 불가능했다(사용자 요청: "깊은궁합 포함해서 전부 줄 수 있게").
//
//   🔴 이 파일의 존재 이유는 목록이 아니라 **scope** 다.
//      product_entitlements 는 상품마다 scope_key 형식이 다르고, **게이트마다 매칭 방식이 다르다.**
//      형식이 어긋나면 행은 멀쩡히 생기는데 화면은 계속 잠긴다 — 에러도 안 난다.
//      예) year-core 게이트는 'year:{readingKey}:{연도}' 를 파싱한다. 'global' 을 넣으면
//          파싱 실패 → 조용히 미인식. 부여는 "성공" 이라고 뜬다.
//      그래서 부여 경로는 결제와 **같은 함수**(resolvePaymentProductScope)로 scope 를 만든다.
//      여기서는 그 함수가 필요로 하는 입력(need)만 선언한다.
//
//   ⚠️ 'global' 이 통하는 상품과 안 통하는 상품이 갈리는 이유:
//      getProductEntitlement 는 .in('scope_key', [요청scope, 'global']) 로 조회하므로
//      단일 조회형 게이트(궁합·연애·돈·일)는 global 한 방으로 열린다. 반면
//      scope 를 **파싱**하는 게이트(달력·올해핵심·점수요소)는 global 을 이해하지 못한다.
import type { PackageId } from '@/lib/payments/catalog';

/** 부여에 필요한 추가 입력. UI 가 이걸 보고 입력칸을 띄운다. */
export type AdminGrantNeed = 'none' | 'reading' | 'reading-month' | 'reading-year';

export interface AdminGrantProduct {
  packageId: PackageId;
  /** 관리자 화면 라벨(카탈로그 name 과 별개로 무엇이 열리는지 적는다). */
  label: string;
  need: AdminGrantNeed;
  /** 부여 결과의 **유효 범위**. 관리자가 이걸 모르면 "줬는데 안 열린다" 문의가 온다. */
  note: string;
  /** 판매중단 상품 — 부여는 되지만 신규 결제 경로는 없다. */
  retired?: boolean;
}

export const ADMIN_GRANT_PRODUCTS: readonly AdminGrantProduct[] = [
  // ── 사주 결과 단위 ────────────────────────────────────────────────
  {
    packageId: 'taste_score_total',
    label: '사주 점수 공개',
    need: 'reading',
    note: '선택한 사주에 영구. 같은 사주면 이름·경로가 달라도 인정된다.',
  },
  {
    packageId: 'taste_score_factor',
    label: '점수 풀이 5요소 (F1~F5)',
    need: 'reading',
    note: 'F1~F5 를 한 번에 부여한다. 하나만 주는 경로는 두지 않았다.',
  },
  {
    packageId: 'taste_monthly_calendar',
    label: '월간 달력',
    need: 'reading-month',
    note: '지정한 달만 열린다. 다른 달은 별도 부여.',
  },
  {
    packageId: 'taste_year_core',
    label: '올해 핵심 3줄',
    need: 'reading-year',
    note: '지정한 연도만 열린다.',
  },
  {
    packageId: 'taste_today_detail',
    label: '오늘 자세히 보기',
    need: 'reading',
    note: '⚠️ 당일권이다 — 부여한 날(KST)만 열린다. 내일 다시 필요하면 다시 부여.',
  },
  {
    packageId: 'bundle_comprehensive',
    label: '종합사주 리포트 (묶음)',
    need: 'reading',
    note: '구성품 5종(점수·오늘·돈·일·올해)을 한 번에 부여한다.',
  },
  {
    packageId: 'bundle_today_set',
    label: '오늘 풀세트 (묶음)',
    need: 'reading',
    note: '구성품 6종을 부여한다.',
    retired: true,
  },

  // ── 전역(사주 무관) ──────────────────────────────────────────────
  {
    packageId: 'taste_compat_reading',
    label: '궁합 깊은 풀이',
    need: 'none',
    note: '전역 부여 — 이 회원의 **모든 커플** 궁합 깊은 풀이가 영구히 열린다(커플 지정 불가).',
  },
  {
    packageId: 'taste_money_pattern',
    label: '돈이 새는 패턴',
    need: 'none',
    note: '전역·영구.',
  },
  {
    packageId: 'taste_work_flow',
    label: '일/직장 흐름',
    need: 'none',
    note: '전역·영구.',
  },
  {
    packageId: 'taste_love_question',
    label: '연애 마음 확인 (구 궁합 전역권)',
    need: 'none',
    note: '전역·영구. 궁합 전 커플 열람도 함께 열린다(grandfather 경로).',
    retired: true,
  },

  // ── 당일권 ──────────────────────────────────────────────────────
  {
    packageId: 'taste_today_basic',
    label: '간단운세 당일권',
    need: 'none',
    note: '⚠️ 오늘(KST)만 유효.',
  },
  {
    packageId: 'taste_tarot_daily',
    label: '타로 세 장 당일권',
    need: 'none',
    note: '⚠️ 오늘(KST)만 유효.',
  },
  {
    packageId: 'taste_dream_search',
    label: '꿈해몽 당일권',
    need: 'none',
    note: '⚠️ 오늘(KST)만 유효.',
  },
  {
    packageId: 'taste_taekil',
    label: '택일 당일권',
    need: 'none',
    note: '⚠️ 오늘(KST)만 유효.',
  },

  // ── 이용권이 아닌 것 ─────────────────────────────────────────────
  {
    packageId: 'taste_dialogue_entry',
    label: '대화상담 질문 3회',
    need: 'none',
    note: '⚠️ 이용권이 아니라 **전 3개**를 지급한다(게이트가 전 잔액을 본다). 결제와 동일.',
  },
] as const;

export function findAdminGrantProduct(packageId: unknown): AdminGrantProduct | undefined {
  return ADMIN_GRANT_PRODUCTS.find((p) => p.packageId === packageId);
}

/** score-factor 는 5요소를 한 번에 준다 — 부여 경로에서 scope 를 순회한다. */
export const SCORE_FACTOR_SCOPES = ['F1', 'F2', 'F3', 'F4', 'F5'] as const;

/** 'YYYY-MM' 검증. resolvePaymentProductScope 가 이 형식만 달 scope 로 인정한다. */
export function isYearMonthScope(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** 'YYYY' 검증. */
export function isYearScope(value: string): boolean {
  return /^\d{4}$/.test(value);
}
