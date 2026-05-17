import type { MetadataRoute } from 'next';
import { CANONICAL_SITE_URL } from '@/lib/site';

/**
 * Phase 1 (2026-05-18): canonical = https://ganjisaju.kr.
 * host / sitemap 모두 canonical 절대 URL 사용.
 *
 * disallow 정책:
 *   - /api/                : 백엔드 API
 *   - 인증 흐름            : /login, /signup, /auth, /forgot-password, /reset-password
 *   - 사용자 개별 페이지   : /my, /admin, /dialogue/history, /notifications
 *   - 결제 결과 페이지     : /credits/success, /membership/complete, /membership/success
 *   - 사주 결과 (개인 slug): /saju/[slug]/ (단 진입점 /saju 자체는 SEO 노출 가능 — 추후 검토)
 *   - SHELL/lock-screen   : /lock-screen (incomplete-ui-inventory P0)
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/credits',
          '/today-fortune',
          '/tarot/daily',
          '/zodiac',
          '/zodiac/',
          '/star-sign',
          '/star-sign/',
          '/dream-interpretation',
          '/dream-interpretation/',
          '/pricing',
          '/membership',
          '/sample-report',
          '/guide',
          '/about-engine',
          '/method',
          '/terms',
          '/privacy',
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
          // 사용자 개별 / 보호 페이지
          '/my',
          '/admin',
          '/dialogue/history',
          '/notifications',
          // 결제 결과 (one-time URL — 인덱싱 의미 없음)
          '/credits/success',
          '/membership/complete',
          '/membership/success',
          // 사주 결과 (개인 slug, 인증 필요)
          '/saju/',
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
