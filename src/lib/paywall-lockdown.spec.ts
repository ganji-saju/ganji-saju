// 전면 유료화 잠금의 계약을 고정한다.
//   깨지면 안 되는 것 두 가지:
//     1) 결제·계정·법정고지 경로를 절대 잠그지 않는다(잠그면 매출이 죽는다).
//     2) 이미 결제한 사용자의 열람 경로(/today-fortune/detail 등)를 라우트 차단하지 않는다.

import { afterEach, describe, expect, it, vi } from 'vitest';

const MODULE = './paywall-lockdown';

async function load(flag: string | undefined) {
  if (flag === undefined) delete process.env.NEXT_PUBLIC_PAYWALL_LOCKDOWN;
  else process.env.NEXT_PUBLIC_PAYWALL_LOCKDOWN = flag;
  // 모듈이 env 를 호출 시점에 읽지만, 소비 모듈이 import 시점에 굳히는 경우가 있어 캐시를 비운다.
  const mod = await import(MODULE);
  return mod as typeof import('./paywall-lockdown');
}

afterEach(() => {
  delete process.env.NEXT_PUBLIC_PAYWALL_LOCKDOWN;
});

describe('paywall lockdown', () => {
  it('기본값은 잠금 ON — env 없이도 무료 콘텐츠가 막힌다', async () => {
    const { isPaywallLockdown, isLockedPath } = await load(undefined);
    expect(isPaywallLockdown()).toBe(true);
    expect(isLockedPath('/zodiac')).toBe(true);
    expect(isLockedPath('/tarot/daily/pick')).toBe(true);
  });

  it("NEXT_PUBLIC_PAYWALL_LOCKDOWN=false 면 전부 원상복구", async () => {
    const { isPaywallLockdown, isLockedPath, isAnonymousBlockedPath, keepVisible } =
      await load('false');
    expect(isPaywallLockdown()).toBe(false);
    expect(isLockedPath('/zodiac')).toBe(false);
    expect(isAnonymousBlockedPath('/today-fortune')).toBe(false);
    expect(keepVisible([{ href: '/free' }], (i) => i.href)).toHaveLength(1);
  });

  it('샘플 리포트는 잠그지 않는다 — 유료 리포트의 설득 자산(2026-08-24 Phase 0 해제)', async () => {
    // "결과가 얼마나 자세하지?"에 답하는 유일한 무료 지면. 다시 잠그면 결제 전환을 스스로 깎는다.
    //   입력 화면·결제 화면의 ReportTrustNotes 가 /sample-report 로 링크한다 — 잠그면 그 링크가
    //   /pricing 으로 튕기는 낚시가 된다.
    const { isLockedPath } = await load(undefined);
    expect(isLockedPath('/sample-report')).toBe(false);
  });

  it('결제·계정·법정고지·유료 랜딩은 잠그지 않는다', async () => {
    const { isLockedPath } = await load(undefined);
    for (const open of [
      '/',
      '/pricing',
      '/membership',
      '/membership/checkout',
      '/saju/new',
      '/compatibility/input',
      '/daewoon',
      '/taekil',
      '/my/results',
      '/my/billing',
      '/legal',
      '/terms',
      '/guide',
      '/login',
    ]) {
      expect(isLockedPath(open), open).toBe(false);
    }
  });

  // 🔴 이 단언이 깨지면 결제한 사용자가 자기 구매물을 못 본다. (B)를 proxy 목록에 넣지 말 것.
  it('(B)갈래는 proxy 라우트 차단 대상이 아니다 — 결제자 열람 경로가 같은 프리픽스', async () => {
    const { isLockedPath } = await load(undefined);
    for (const open of [
      '/today-fortune', // 결제 복귀 경로(?paid=today-detail)가 여기로 온다
      '/today-fortune/detail',
      '/today-fortune/result',
      '/today-fortune/runs/abc',
      '/today-fortune/snapshots/abc',
      '/today-fortune/share/abc',
      '/dialogue',
      '/dialogue/dragon',
      '/dialogue/history',
    ]) {
      expect(isLockedPath(open), open).toBe(false);
    }
  });

  it('(B) 무료 진입 경로는 정확 일치 — 결제자 열람 하위경로를 삼키지 않는다', async () => {
    const { isFreeEntryPath } = await load(undefined);
    expect(isFreeEntryPath('/today-fortune')).toBe(true);
    expect(isFreeEntryPath('/today-fortune/result')).toBe(true);
    expect(isFreeEntryPath('/dialogue')).toBe(true);
    // 🔴 아래가 true 가 되면 결제자가 자기 구매물을 못 본다.
    for (const paid of [
      '/today-fortune/detail',
      '/today-fortune/runs/abc',
      '/today-fortune/snapshots/abc',
      '/today-fortune/share/abc',
      '/dialogue/history',
      '/dialogue/history/abc',
      '/dialogue/appointment',
      '/dialogue/dragon',
    ]) {
      expect(isFreeEntryPath(paid), paid).toBe(false);
    }
    expect((await load('false')).isFreeEntryPath('/today-fortune')).toBe(false);
  });

  it('(B)갈래는 메뉴에 남기고(유료 메뉴) sitemap 에서만 뺀다', async () => {
    const { isMenuHiddenHref, isAnonymousBlockedPath } = await load(undefined);
    // 메뉴에는 남는다 — 감추면 오늘운세가 혜택인 프리미엄 회원이 진입로를 잃는다.
    expect(isMenuHiddenHref('/today-fortune')).toBe(false);
    expect(isMenuHiddenHref('/dialogue')).toBe(false);
    // 익명 크롤러에겐 리다이렉트라 색인 제출에서는 뺀다.
    expect(isAnonymousBlockedPath('/today-fortune')).toBe(true);
    expect(isAnonymousBlockedPath('/dialogue')).toBe(true);
    expect(isAnonymousBlockedPath('/zodiac')).toBe(true);
    expect(isAnonymousBlockedPath('/saju/new')).toBe(false);
    expect(isAnonymousBlockedPath('/pricing')).toBe(false);
  });

  it('프리픽스 매칭은 경계에서 끊는다 — /free 가 /freedom 을 삼키지 않는다', async () => {
    const { isLockedPath } = await load(undefined);
    expect(isLockedPath('/free')).toBe(true);
    expect(isLockedPath('/free/anything')).toBe(true);
    expect(isLockedPath('/freedom')).toBe(false);
  });

  it('href 의 쿼리·해시·외부링크를 올바로 다룬다', async () => {
    const { isMenuHiddenHref } = await load(undefined);
    expect(isMenuHiddenHref('/tarot/daily?from=taekil')).toBe(true);
    expect(isMenuHiddenHref('/dream?q=%EB%B1%80')).toBe(true);
    expect(isMenuHiddenHref('/#compatibility-lab')).toBe(false);
    expect(isMenuHiddenHref('mailto:help@example.com')).toBe(false);
    expect(isMenuHiddenHref('https://example.com/zodiac')).toBe(false);
  });
});

// 메뉴 데이터는 import 시점에 필터가 굳는다 → 모듈 캐시를 비우고 다시 읽어야 잠금 상태가 보인다.
async function freshImport<T>(specifier: string, lockdown: boolean): Promise<T> {
  process.env.NEXT_PUBLIC_PAYWALL_LOCKDOWN = lockdown ? 'true' : 'false';
  vi.resetModules();
  return (await import(specifier)) as T;
}

describe('lockdown이 켜지면 메뉴 데이터에서 무료 항목이 사라진다', () => {
  it('하단 탭·헤더 숏컷에서 무료 진입점 제거 (유료 메뉴는 유지)', async () => {
    const locked = await freshImport<typeof import('@/content/moonlight')>(
      '@/content/moonlight',
      true
    );
    expect(locked.PRIMARY_TABS.map((t) => t.label)).not.toContain('무료운세');
    expect(locked.PRIMARY_TABS.map((t) => t.label)).toEqual(
      expect.arrayContaining(['홈', '사주추가', '대화방', '보관함'])
    );
    // 타로·띠운세·별자리(A, 잠김)는 빠지고 오늘운세(B, 결제자 통과)·사주·궁합은 남는다.
    const shortcuts = locked.HEADER_SHORTCUTS.map((s) => s.label);
    expect(shortcuts).toEqual(['오늘운', '사주', '궁합']);

    const open = await freshImport<typeof import('@/content/moonlight')>(
      '@/content/moonlight',
      false
    );
    expect(open.PRIMARY_TABS.map((t) => t.label)).toContain('무료운세');
    expect(open.HEADER_SHORTCUTS).toHaveLength(6);
  });

  it('메가 메뉴에 잠긴 링크·FREE 배지·"무료" 카피가 남지 않는다', async () => {
    const locked = await freshImport<typeof import('@/features/shared-navigation/mega-nav-data')>(
      '@/features/shared-navigation/mega-nav-data',
      true
    );

    const copy = JSON.stringify(locked.MEGA_NAV);
    expect(copy).not.toContain('무료');
    expect(copy).not.toContain('FREE');
    for (const lockedHref of ['/tarot', '/zodiac', '/star-sign', '/dream', '/free']) {
      expect(copy, lockedHref).not.toContain(lockedHref);
    }
    // 유료 진입로는 살아 있어야 한다.
    expect(copy).toContain('/today-fortune');
    expect(copy).toContain('/saju/new');

    // 활성 판정은 실존하는 라벨만 돌려줘야 한다(하이라이트 유실 방지).
    const labels = locked.MEGA_NAV.map((g) => g.label);
    expect(labels).toContain(locked.resolveActiveGroup('/zodiac'));
    expect(labels).toContain(locked.resolveActiveGroup('/'));
  });

  it('홈 카드·배너·무료 허브에서 무료 항목 제거', async () => {
    const locked = await freshImport<typeof import('@/content/gangi-market')>(
      '@/content/gangi-market',
      true
    );
    // 2026-08-24 Phase 1 — 단품 강등: 대운·택일 카드는 홈에서 내려갔다(교차추천으로 이동).
    // 2026-08-25 — 990원 당일권 전환으로 간단운세(today)·대화상담(consult)은 유료 카드가 돼
    //   잠금 중에도 남는다(타로·꿈해몽은 (A)잠금 라우트라 keepVisible 이 제거).
    expect(locked.GANGI_HOME_CARDS.map((c) => c.id)).toEqual([
      'saju',
      'gunghap',
      'today',
      'consult',
    ]);
    expect(locked.GANGI_HOME_CARDS.every((c) => c.price !== '무료')).toBe(true);
    expect(locked.GANGI_HOME_BANNERS.map((b) => b.id)).not.toContain('tarot-free');
    expect(locked.GANGI_HOME_BANNERS.map((b) => b.id)).not.toContain('dream');
    expect(locked.GANGI_FREE_ACTIONS).toHaveLength(0);
    expect(locked.GANGI_FREE_HUB_ITEMS).toHaveLength(0);

    const open = await freshImport<typeof import('@/content/gangi-market')>(
      '@/content/gangi-market',
      false
    );
    // 2026-08-25 — 990원 4종 + 무료 2종(띠운세·별자리) 복귀로 8카드, 허브는 진짜 무료 2종.
    expect(open.GANGI_HOME_CARDS).toHaveLength(8);
    expect(open.GANGI_FREE_HUB_ITEMS).toHaveLength(2);
  });

  it('사용방법 2단계가 잠긴 무료 메뉴를 약속하지 않는다', async () => {
    const locked = await freshImport<
      typeof import('@/features/system-guide/system-guide-content')
    >('@/features/system-guide/system-guide-content', true);
    const step = locked.SYSTEM_GUIDE_STEPS.find((s) => s.id === 'fortune')!;
    expect(step.description).not.toMatch(/무료|타로|띠운세|별자리/);
    // 6단계 구성 자체는 잠금과 무관하게 유지된다.
    expect(locked.SYSTEM_GUIDE_STEPS).toHaveLength(6);
  });
});
