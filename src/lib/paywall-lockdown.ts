// 2026-08-11 — 전면 유료화 잠금(reversible lockdown).
//
// 목적: "무료로 볼 수 있는 메뉴·콘텐츠"를 전부 감추고 결제 경로만 남긴다.
//
// ── 되돌리는 법 (코드 수정 없음) ──────────────────────────────────────────────
//   Vercel env 에 NEXT_PUBLIC_PAYWALL_LOCKDOWN=false 를 넣고 **재배포**하면
//   잠금 이전 상태로 100% 복원된다. env 를 지우거나 다른 값을 넣으면 다시 잠긴다.
//   (NEXT_PUBLIC_* 는 빌드 타임 인라인이라 재배포가 필요하다 — 런타임 즉시 토글이
//    필요해지면 DB 설정으로 승격할 것. ponytail: 지금은 env 로 충분.)
//
// ── 설계 ──────────────────────────────────────────────────────────────────
//   무료 표면은 성격이 두 가지라 처리도 두 가지다.
//
//   (A) 유료 상품이 뒤에 없는 순수 무료 콘텐츠 → **라우트째 차단**(→ /pricing).
//       띠운세·별자리·타로·꿈해몽·무료허브·샘플리포트·명리 소개 등.
//
//   (B) 유료 상품의 무료 티어(맛보기) → **무료 할당량 0 + 진입 페이지 게이트(결제자 통과)**.
//       오늘운세(→ 오늘 자세히 3,300원)·대화상담(→ 전 차감)이 여기 해당.
//       ⚠️ (B)를 proxy 에서 프리픽스로 막으면 **이미 결제한 사용자가 자기 구매물을 못 본다**
//         — /today-fortune/detail·/runs·/snapshots 와 결제 직후 복귀 경로
//         (/today-fortune?paid=today-detail&sourceSessionId=…)가 전부 같은 프리픽스다.
//         그래서 (B)는 절대 LOCKED_PATH_PREFIXES 에 넣지 않고, **무료 진입 페이지에만**
//         guardLockedFreeEntry()(paywall-lockdown.server.ts)를 건다.
//       할당량 0 처리는 src/lib/free-usage/daily-limit.ts 가 담당한다.
//
//   (B)는 게이트가 붙은 순간 "무료 메뉴"가 아니라 **유료 메뉴**다 → 메뉴에서 감추지 않는다.
//   (감추면 오늘운세 무제한이 혜택인 프리미엄 회원이 진입로를 잃는다.)
//   대신 비로그인·크롤러에겐 사실상 차단이라 **sitemap 에서는 뺀다**(GSC 리다이렉트 오류 방지).
//
// ── 일부러 잠그지 않은 것 ──────────────────────────────────────────────────
//   · 결제/계정/법정고지(/pricing·/membership·/my·/legal·/terms…) — 잠그면 결제가 죽는다.
//   · /daewoon·/taekil·/compatibility — 무료처럼 보이지만 결제 CTA 랜딩(매출 경로)이다.
//   · /guide(사용방법)·/support — 결제한 사용자도 봐야 하는 도움말.
//   · /*/share/[slug] 공유 링크 — 수신자 재현(바이럴 유입). 막으려면 '/공유경로'를
//     LOCKED_PATH_PREFIXES 에 한 줄 추가하면 된다.

/** 잠금 활성 여부. 기본값 ON — 끄려면 NEXT_PUBLIC_PAYWALL_LOCKDOWN=false. */
export function isPaywallLockdown(): boolean {
  return process.env.NEXT_PUBLIC_PAYWALL_LOCKDOWN !== 'false';
}

/**
 * (A) 라우트째 차단할 무료 콘텐츠 프리픽스. 여기 있는 경로는 /pricing 으로 307 된다.
 * 범위를 좁히려면 줄을 지우면 된다 — 이 배열이 유일한 조절 손잡이다.
 */
export const LOCKED_PATH_PREFIXES = [
  '/free', // 무료운세 허브
  '/tarot', // 타로 세 장 (유료 타로 상품 없음)
  '/zodiac', // 띠운세
  '/star-sign', // 별자리 (+ 12×12 궁합 매트릭스)
  '/dream', // 꿈해몽 검색
  '/dream-interpretation', // 꿈해몽 사전 SEO 페이지
  '/interpretation', // 무료 해석 허브
  '/about-engine', // → /interpretation 리다이렉트 스텁
  '/method', // 허브·[slug] 모두 /interpretation 리다이렉트 스텁(실콘텐츠 없음)
  // '/sample-report' — 2026-08-24 전면 개편 Phase 0 에서 잠금 해제. 유료 리포트의 무료 샘플은
  //   "결과가 얼마나 자세하지?"에 답하는 설득 자산이라 잠그면 결제 전환을 스스로 깎는다
  //   (수정요청 PPT 1차 의문 ③). 무료 '콘텐츠'가 아니라 유료 상품의 광고 지면으로 취급한다.
  '/myeongri', // 명리 소개/십신 무료 읽을거리
] as const;

/**
 * (B) 무료 진입 페이지에 결제자 통과 게이트를 건 프리픽스.
 * ⚠️ proxy 는 이 목록을 쓰면 안 된다 — 결제자 열람 경로가 같은 프리픽스에 있다.
 *    게이트는 각 무료 진입 페이지가 guardLockedFreeEntry() 로 직접 건다.
 * 여기 쓰이는 곳은 **sitemap 제외 판정뿐**(익명 크롤러에겐 어차피 리다이렉트라 색인 불가).
 */
export const PAID_ONLY_ENTRY_PREFIXES = [
  '/today-fortune', // 간단운세 무료 진입 — 결제 이력 있으면 통과
  '/today', // 위의 별칭 리다이렉트
  '/dialogue', // 대화상담 — 여기서 유료 대화(전 차감)도 일어난다
] as const;

function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/** 경로가 (A) 라우트째 차단 대상인가. **proxy 전용** — (B)를 넣으면 결제자가 막힌다. */
export function isLockedPath(pathname: string): boolean {
  if (!isPaywallLockdown()) return false;
  return matchesPrefix(pathname, LOCKED_PATH_PREFIXES);
}

/**
 * (B) 무료 진입 **정확 경로**. 비로그인 방문자·크롤러는 proxy 가 여기서 307 로 끊는다.
 *
 * 왜 필요한가: 이 경로들의 페이지 게이트만으로는 부족하다. /today-fortune 에는
 *   loading.tsx(Suspense)가 있어 헤더가 200 으로 먼저 나가고 redirect 가
 *   **클라이언트 리다이렉트**(meta refresh + 라우터 replace)로 떨어진다 —
 *   콘텐츠는 안 새지만 스켈레톤이 한 번 번쩍이고 크롤러엔 soft redirect 로 보인다.
 * 비로그인은 결제 이력이 있을 수 없으므로(결제엔 로그인 필요) DB 조회 없이 확정 판정 가능.
 * 로그인 사용자는 통과시켜 페이지의 guardLockedFreeEntry() 가 결제 이력을 판정한다.
 *
 * ⚠️ 프리픽스가 아니라 **정확 일치**다. /today-fortune/detail·/runs·/dialogue/history 등
 *    하위 경로를 삼키면 결제자 열람이 막힌다.
 */
export const FREE_ENTRY_PATHS = [
  '/today-fortune',
  '/today-fortune/result',
  '/dialogue',
] as const;

export function isFreeEntryPath(pathname: string): boolean {
  if (!isPaywallLockdown()) return false;
  return (FREE_ENTRY_PATHS as readonly string[]).includes(pathname);
}

/** 익명 방문자(=크롤러)에게 콘텐츠가 안 보이는 경로인가. sitemap 제외 판정용. */
export function isAnonymousBlockedPath(pathname: string): boolean {
  if (!isPaywallLockdown()) return false;
  return (
    matchesPrefix(pathname, LOCKED_PATH_PREFIXES) ||
    matchesPrefix(pathname, PAID_ONLY_ENTRY_PREFIXES)
  );
}

/** href 에서 pathname 만 뽑는다. 외부/앵커/메일 링크는 null. */
function pathnameOf(href: string): string | null {
  if (!href.startsWith('/')) return null; // http(s):, mailto:, tel:, #anchor
  const cut = href.search(/[?#]/);
  const pathname = cut === -1 ? href : href.slice(0, cut);
  return pathname === '' ? '/' : pathname;
}

/**
 * 메뉴/카드/검색결과에서 감출 링크인가.
 * (A)만 감춘다 — (B)는 게이트가 붙은 유료 메뉴라 진입로를 남겨야 한다.
 */
export function isMenuHiddenHref(href: string): boolean {
  if (!isPaywallLockdown()) return false;
  const pathname = pathnameOf(href);
  if (!pathname) return false;
  return matchesPrefix(pathname, LOCKED_PATH_PREFIXES);
}

/** 목록에서 감출 링크를 걸러낸다. 잠금 OFF 면 원본 그대로. */
export function keepVisible<T>(items: readonly T[], hrefOf: (item: T) => string): T[] {
  if (!isPaywallLockdown()) return [...items];
  return items.filter((item) => !isMenuHiddenHref(hrefOf(item)));
}
