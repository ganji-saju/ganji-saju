/**
 * 결제 중복 방지 + 금액 일치 회귀 검사 (2026-05-14)
 *
 * 사용자 보고: "today-detail 을 결제했는데 또 결제하라고 나온다."
 *
 * 이 spec 은 모든 결제 흐름에 대해:
 *   1) catalog 상품 정의가 유일한 packageId / slug 를 갖는지
 *   2) 화면에 표시되는 가격과 서버에서 검증하는 가격이 일치하는지
 *      (validatePaymentConfirmationPayload 는 클라이언트가 보낸 amount 와
 *      catalog 가격을 1원 단위로 비교한다)
 *   3) scope key 생성기가 동일 입력에 대해 항상 같은 키를 만들어 내는지
 *   4) today-detail / monthly-calendar / year-core 스코프가 reading 식별자에
 *      의존하므로 사주 slug 가 같으면 동일 스코프 키가 나오는지
 *
 * 자동화 의의: 새 상품을 추가하거나 가격을 변경할 때 별도 수동 결제 없이
 * 이 spec 만 통과하면 catalog 정합성·중복 방지 기본기는 보장된다.
 */

import { describe, expect, it } from 'vitest';
import {
  PAYMENT_PACKAGES,
  getPackage,
  isTasteProductPackage,
  type PaymentPackage,
  type TasteProductId,
} from '@/lib/payments/catalog';
import { validatePaymentConfirmationPayload } from '@/lib/payments/confirmation';
import {
  buildLifetimeReportScopeKey,
  buildMonthlyCalendarScopeKey,
  buildReadingProductScopeKey,
  buildTodayDetailScopeKey,
  buildYearCoreScopeKey,
  parseYearMonthScope,
  parseYearScope,
  getPaidProductIdFromPackage,
  resolvePaymentProductScope,
} from '@/lib/payments/product-scope';
import { toSlug } from '@/lib/saju/pillars';
import type { BirthInput } from '@/lib/saju/types';

describe('Payment catalog 정합성', () => {
  it('packageId 와 tasteProductId 는 카탈로그 안에서 유일하다', () => {
    const all = PAYMENT_PACKAGES as readonly PaymentPackage[];
    const ids = all.map((pkg) => pkg.id);
    expect(new Set(ids).size).toBe(ids.length);

    const tasteIds = all
      .filter(isTasteProductPackage)
      .map((pkg) => pkg.tasteProductId);
    expect(new Set(tasteIds).size).toBe(tasteIds.length);
  });

  it('모든 패키지가 양의 가격 + 정수 원 단위를 가진다', () => {
    for (const pkg of PAYMENT_PACKAGES as readonly PaymentPackage[]) {
      expect(pkg.price).toBeGreaterThan(0);
      expect(Number.isInteger(pkg.price)).toBe(true);
    }
  });

  it('requiresSlug 패키지도 confirm callback 에서는 order ledger 가 scope 를 소유한다', () => {
    const requireSlugPkgs = (PAYMENT_PACKAGES as readonly PaymentPackage[]).filter(
      (pkg) => pkg.requiresSlug || pkg.kind === 'lifetime_report'
    );
    expect(requireSlugPkgs.length).toBeGreaterThan(0);

    for (const pkg of requireSlugPkgs) {
      const validation = validatePaymentConfirmationPayload({
        paymentKey: 'test_pk_dummy',
        orderId: `test_order_${pkg.id}`,
        amount: pkg.price,
        packageId: pkg.id,
        slug: '',
      });
      expect(validation.ok).toBe(true);
    }
  });
});

describe('서버 측 금액 재검증', () => {
  it('카탈로그 가격과 다른 amount 가 들어오면 거부한다', () => {
    for (const pkg of PAYMENT_PACKAGES as readonly PaymentPackage[]) {
      const validation = validatePaymentConfirmationPayload({
        paymentKey: 'test_pk_dummy',
        orderId: `test_order_${pkg.id}`,
        amount: pkg.price + 1, // 1원만 깎으려고 시도
        packageId: pkg.id,
        slug: pkg.requiresSlug || pkg.kind === 'lifetime_report' ? 'test-slug' : null,
      });
      expect(validation.ok).toBe(false);
    }
  });

  it('카탈로그 가격과 같은 amount + 필요한 슬러그가 있으면 통과한다', () => {
    for (const pkg of PAYMENT_PACKAGES as readonly PaymentPackage[]) {
      const slug =
        pkg.requiresSlug || pkg.kind === 'lifetime_report' ? 'test-slug' : null;

      const validation = validatePaymentConfirmationPayload({
        paymentKey: 'test_pk_dummy',
        orderId: `test_order_${pkg.id}`,
        amount: pkg.price,
        packageId: pkg.id,
        slug,
      });

      expect(validation.ok).toBe(true);
      if (validation.ok) {
        expect(validation.input.amount).toBe(pkg.price);
        expect(validation.input.pkg.id).toBe(pkg.id);
      }
    }
  });

  it('알 수 없는 packageId 는 거부한다', () => {
    const validation = validatePaymentConfirmationPayload({
      paymentKey: 'test_pk_dummy',
      orderId: 'test_order_unknown',
      amount: 550,
      packageId: 'NON_EXISTENT_PACKAGE',
      slug: null,
    });
    expect(validation.ok).toBe(false);
  });
});

describe('Scope key 결정성 — 같은 입력은 항상 같은 key 를 만든다', () => {
  it('buildTodayDetailScopeKey 는 입력 slug 마다 결정적', () => {
    expect(buildTodayDetailScopeKey('abc')).toBe('today:abc');
    expect(buildTodayDetailScopeKey('abc')).toBe(buildTodayDetailScopeKey('abc'));
    expect(buildTodayDetailScopeKey('abc')).not.toBe(buildTodayDetailScopeKey('def'));
  });

  it('buildReadingProductScopeKey 는 readingKey 마다 결정적', () => {
    expect(buildReadingProductScopeKey('reading-x')).toBe('reading:reading-x');
  });

  it('buildMonthlyCalendarScopeKey 는 readingKey + 연-월 결합', () => {
    expect(buildMonthlyCalendarScopeKey('rx', 2026, 5)).toBe('calendar:rx:2026-05');
    expect(buildMonthlyCalendarScopeKey('rx', 2026, 5)).toBe(
      buildMonthlyCalendarScopeKey('rx', 2026, 5)
    );
    expect(buildMonthlyCalendarScopeKey('rx', 2026, 5)).not.toBe(
      buildMonthlyCalendarScopeKey('rx', 2026, 6)
    );
  });

  it('buildYearCoreScopeKey 는 readingKey + 연 결합', () => {
    expect(buildYearCoreScopeKey('rx', 2026)).toBe('year:rx:2026');
    expect(buildYearCoreScopeKey('rx', 2026)).not.toBe(buildYearCoreScopeKey('ry', 2026));
  });

  it('buildLifetimeReportScopeKey 는 readingKey 만 사용', () => {
    expect(buildLifetimeReportScopeKey('rx')).toBe('lifetime:rx');
  });

  it('서로 다른 product 의 scope key 는 충돌하지 않는다 (prefix 분리)', () => {
    const today = buildTodayDetailScopeKey('A');
    const reading = buildReadingProductScopeKey('A');
    const calendar = buildMonthlyCalendarScopeKey('A', 2026, 5);
    const year = buildYearCoreScopeKey('A', 2026);
    const life = buildLifetimeReportScopeKey('A');
    const all = [today, reading, calendar, year, life];
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('Scope 파서 유효성 검사', () => {
  it('parseYearMonthScope: 정상/비정상 입력', () => {
    expect(parseYearMonthScope('2026-05')).toEqual({ year: 2026, month: 5 });
    expect(parseYearMonthScope('2026-5')).toEqual({ year: 2026, month: 5 });
    expect(parseYearMonthScope('2026-13')).toBeNull();
    expect(parseYearMonthScope('not-a-date')).toBeNull();
    expect(parseYearMonthScope(null)).toBeNull();
  });

  it('parseYearScope: 정상/비정상 입력', () => {
    expect(parseYearScope('2026')).toBe(2026);
    expect(parseYearScope('abcd')).toBeNull();
    expect(parseYearScope('')).toBeNull();
  });
});

describe('Product ID ↔ Package 매핑', () => {
  it('각 TasteProductId 가 정확히 하나의 카탈로그 패키지를 가진다', () => {
    const tasteIds: TasteProductId[] = [
      'today-detail',
      'love-question',
      'money-pattern',
      'work-flow',
      'monthly-calendar',
      'year-core',
    ];

    const all = PAYMENT_PACKAGES as readonly PaymentPackage[];
    for (const id of tasteIds) {
      const pkg = all.find(
        (entry) => isTasteProductPackage(entry) && entry.tasteProductId === id
      );
      expect(pkg, `tasteProductId '${id}' 의 카탈로그 패키지가 없습니다`).toBeDefined();
    }
  });

  it('getPaidProductIdFromPackage 는 lifetime / taste 만 식별한다', () => {
    for (const pkg of PAYMENT_PACKAGES as readonly PaymentPackage[]) {
      const productId = getPaidProductIdFromPackage(pkg as PaymentPackage);
      if (isTasteProductPackage(pkg as PaymentPackage)) {
        expect(productId).toBe(pkg.tasteProductId);
      } else if (pkg.kind === 'lifetime_report') {
        expect(productId).toBe('lifetime-report');
      } else {
        expect(productId).toBeNull();
      }
    }
  });
});

describe('getPackage 조회 안정성', () => {
  it('packageId 로 catalog 조회 성공', () => {
    for (const pkg of PAYMENT_PACKAGES as readonly PaymentPackage[]) {
      expect(getPackage(pkg.id)?.id).toBe(pkg.id);
    }
  });

  it('존재하지 않는 id 는 falsy (null 또는 undefined)', () => {
    expect(getPackage('does-not-exist')).toBeFalsy();
  });
});

// 2026-06-07 (#428) — score-total 결제 grant scope 가 reading 단위로 가는지(=해제 조회와 일치).
//   getScoreUnlockEntitlement 는 getTasteProductEntitlement('score-total',
//   buildReadingProductScopeKey(readingKey)) 로 읽는다. grant 가 lifetime fallback 으로
//   새면 "결제했는데 점수 안 열림" 버그가 된다. 인코딩 slug 는 resolveReading 이 무DB
//   (fromSlug 인메모리)로 풀어 결정적으로 검증 가능.
describe('score-total: 결제 grant scope ↔ 해제 조회 scope 일치 (#428)', () => {
  const SAMPLE_BIRTH: BirthInput = {
    year: 1990,
    month: 5,
    day: 15,
    hour: 10,
    minute: 30,
    gender: 'male',
    jasiMethod: 'unified',
    solarTimeMode: 'standard',
    unknownTime: false,
    birthLocation: {
      code: 'KR-SEL',
      label: '서울',
      latitude: 37.5665,
      longitude: 126.978,
      timezone: 'Asia/Seoul',
    },
  };

  it('resolvePaymentProductScope(score-total) 는 reading 단위 scope (lifetime 으로 새지 않음)', async () => {
    const pkg = getPackage('taste_score_total');
    expect(pkg).toBeTruthy();

    const slug = toSlug(SAMPLE_BIRTH);
    const scope = await resolvePaymentProductScope({ pkg: pkg!, slug });

    expect(scope?.productId).toBe('score-total');
    // reading 단위(reading:{readingKey})여야 한다. lifetime-reading 으로 새면 해제 불가.
    expect(scope?.kind).toBe('reading');
    expect(scope?.readingKey).toBeTruthy();
    expect(scope?.scopeKey).toBe(buildReadingProductScopeKey(scope!.readingKey!));
    // 해제 조회(getScoreUnlockEntitlement)도 동일 buildReadingProductScopeKey(readingKey)
    //   + 동일 resolveReading(slug) → readingKey 를 사용하므로 결제=해제가 보장된다.
  });
});
