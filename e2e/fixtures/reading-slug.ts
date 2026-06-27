// 2026-06-27 — 테스트 유저의 정식 사주 슬러그를 런타임 유도.
//
// 배경: 기존 인증 E2E(saju.spec·payment-blocks)는 E2E_TEST_READING_SLUG 가 가리키는
//   '영속 readings 행'을 전제했다. 2026-06-26 실운영 전 데이터 초기화(#484)가 readings
//   를 TRUNCATE 하면서 그 행이 사라져 /saju/{slug} 가 notFound → 전 테스트 red.
//
// 근본 해결: 영속 행에 의존하지 말고, 보존된 프로필에서 앱이 만드는 정식 슬러그를 그대로
//   쓴다. 앱은 buildProfileReadingSlug(profile) = toSlug(toBirthInputFromProfile(profile))
//   로 슬러그를 만들고(/saju/{slug} 는 fromSlug 로 즉석 계산 — DB 행 불필요), 이 슬러그
//   로 /saju/{slug} 링크를 SSR 한다(예: /star-sign 의 "내 사주와 함께 보기").
//   → 그 링크의 href 에서 슬러그를 추출하면 앱 로직을 그대로 재사용하므로,
//     /saju/{slug} 점수와 /today-fortune(같은 프로필 자동완성) 점수가 자동 일치한다(#4).
//   → 데이터 초기화에도 안 깨진다(영속 행 0개여도 동작).
//
// @/ import 는 e2e 런타임에서 불안정해(엔g)— 페이지가 이미 렌더한 링크에서 추출한다.
import { expect, type Page } from '@playwright/test';

// 로그인+프로필 사용자에게 /saju/{slug} 링크를 SSR 하는 페이지. star-sign 의
// "내 사주와 함께 보기" Link(href={readingSlug ? `/saju/${readingSlug}` : '/saju/new'}).
const SLUG_SOURCE_PATH = '/star-sign';

/**
 * 인증된 page(storageState) 로 SLUG_SOURCE_PATH 를 열어, 앱이 프로필로 생성한
 * 정식 /saju/{slug} 링크에서 슬러그를 추출한다.
 *
 * 프로필 미설정(readingSlug=null → 링크가 /saju/new) 이면 추출 실패로 명확히 fail.
 */
export async function resolveProfileReadingSlug(page: Page): Promise<string> {
  await page.goto(SLUG_SOURCE_PATH, { waitUntil: 'networkidle' }).catch(() => page.goto(SLUG_SOURCE_PATH));
  await page.waitForLoadState('networkidle').catch(() => {});

  const hrefs = await page
    .locator('a[href^="/saju/"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('href') || ''));

  // /saju/new(프로필 미설정 폴백)·하위경로 제외, 본인 사주 메인 슬러그만.
  const sajuHref = hrefs.find(
    (h) => h.startsWith('/saju/') && h !== '/saju/new' && !h.startsWith('/saju/new')
  );

  expect(
    sajuHref,
    `${SLUG_SOURCE_PATH} 에서 /saju/{slug} 링크 추출 실패 — 테스트 유저 프로필(생년월일) 미설정 의심. ` +
      `발견된 /saju/* href: ${JSON.stringify(hrefs)}`
  ).toBeTruthy();

  // /saju/{slug} → slug (쿼리·해시·trailing path 제거)
  const slug = decodeURIComponent(
    sajuHref!
      .replace(/^\/saju\//, '')
      .split('?')[0]
      .split('#')[0]
      .split('/')[0]
  );

  expect(slug.length, '추출한 슬러그가 비어있지 않아야 함').toBeGreaterThan(0);
  return slug;
}
