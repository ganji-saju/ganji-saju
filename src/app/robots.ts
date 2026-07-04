import type { MetadataRoute } from 'next';
import { CANONICAL_SITE_URL } from '@/lib/site';

/**
 * Phase 1 (2026-05-18): canonical = https://ganjisaju.kr.
 * host / sitemap 모두 canonical 절대 URL 사용.
 *
 * 2026-07-04 SEO 전수감사 반영:
 *   - [critical] disallow '/my'(prefix)가 공개 콘텐츠 /myeongri 까지 차단 → '/my/'+'/my$' 로 축소.
 *   - [critical] disallow '/saju/' 가 핵심 랜딩 /saju/new(sitemap priority 0.95)까지 차단
 *     → allow '/saju/new' 병기(최장 일치 우선). 개인 결과(/saju/[slug])는 계속 차단,
 *     인테이크 하위 스텝(/saju/new/*)은 disallow '/saju/new/' 로 크롤 제외.
 *   - 코인 sunset(6/30) 후 /credits 는 개인 잔액 페이지 → allow 제거·disallow 이동.
 *   - 리다이렉트 스텁(/guide·/about-engine·/method)을 allow 에서 제거, 실서빙 라우트
 *     (/interpretation·/dream·/daewoon·/taekil·/free·/compatibility 등) 추가.
 *   - 결제 체크아웃(/membership/checkout·/pay)·dev·온보딩 disallow 추가.
 *
 * disallow 정책:
 *   - /api/                : 백엔드 API
 *   - 인증 흐름            : /login, /signup, /auth, /forgot-password, /reset-password
 *   - 사용자 개별 페이지   : /my/, /admin, /dialogue/history, /notifications, /credits
 *   - 결제 화면/결과       : /membership/checkout, /pay, /credits/success·fail, /membership/complete·success
 *   - 사주 결과 (개인 slug): /saju/[slug] (진입점 /saju/new 는 allow)
 *   - 공유 스냅샷(/compatibility/share, /today-fortune/share)은 robots 로 막지 않고
 *     페이지 meta noindex 로 처리(크롤러가 noindex 를 읽을 수 있어야 함) — 여기 추가 금지.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/saju/new',
          '/myeongri',
          '/today-fortune',
          '/tarot/daily',
          '/zodiac',
          '/zodiac/',
          '/star-sign',
          '/star-sign/',
          '/dream',
          '/dream-interpretation/',
          '/daewoon',
          '/taekil',
          '/free',
          '/compatibility',
          '/interpretation',
          '/dialogue',
          '/support/faq',
          '/pricing',
          '/membership',
          '/sample-report',
          // 정책 페이지 9종 (Phase 3-B) — robots metadata 가 페이지별로 동적 noindex 처리 (본문 없으면)
          '/terms',
          '/privacy',
          '/refund-policy',
          '/digital-content-policy',
          '/subscription-policy',
          '/coin-policy',
          '/appointment-policy',
          '/ai-disclaimer',
          '/commerce-disclosure',
        ],
        disallow: [
          // 백엔드
          '/api/',
          // 인증 흐름
          '/login',
          '/signup',
          '/auth',
          '/forgot-password',
          '/reset-password',
          // 사용자 개별 / 보호 페이지 — '/my'(prefix)는 /myeongri 를 차단하므로 금지.
          '/my/',
          '/my$',
          '/admin',
          '/dialogue/history',
          '/dialogue/safe-redirect',
          '/notifications',
          '/onboarding',
          // 개인 잔액(코인 sunset 후 결제 기능 없음) + 결제 결과 (one-time URL)
          '/credits',
          '/credits/success',
          '/credits/fail',
          '/membership/complete',
          '/membership/success',
          // 결제 화면
          '/membership/checkout',
          '/pay',
          // 사주 결과 (개인 slug, 인증 필요) — /saju/new 는 위 allow 로 열림.
          '/saju/',
          // 인테이크 하위 스텝(개인 입력 퍼널)은 크롤 불필요.
          '/saju/new/',
          // dev 네임스페이스 (production 은 notFound 지만 방어적 차단)
          '/dev/',
          // SHELL — incomplete-ui-inventory.md §1.2 (Phase 4-B 에서 라우트 제거 예정)
          '/lock-screen',
          // search 미완성 — incomplete-ui-inventory.md §1.3 (Phase 4-B 처리 전 noindex)
          '/search',
        ],
      },
    ],
    sitemap: `${CANONICAL_SITE_URL}/sitemap.xml`,
    host: CANONICAL_SITE_URL,
  };
}
