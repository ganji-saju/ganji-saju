import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Noto_Sans_KR, Noto_Serif_KR } from "next/font/google";
import "./globals.css";
import SupabaseRecoveryRedirect from "@/components/auth/supabase-recovery-redirect";
import { DEFAULT_DESCRIPTION, SITE_NAME, getSiteUrl } from "@/lib/site";
import {
  buildOrganizationSchema,
  buildWebSiteSchema,
  serializeStructuredData,
} from "@/lib/seo/structured-data";
// 2026-05-15 handoff PR-J: 57 m-toast — 전역 토스트 인프라.
import { AppToaster } from "@/components/notifications/app-toaster";
// 2026-05-16 PR #137 — push 알림 클릭 ack 자동 전송.
import { NotificationClickTracker } from "@/components/notifications/notification-click-tracker";
import { ScrollResetOnNavigate } from "@/shared/layout/scroll-reset-on-navigate";
import { KakaoSdkLoader } from "@/components/kakao/kakao-sdk-loader";
// 2026-07-04 — 자체 방문(유입) 카운트(일 1회 익명 핑, admin 지표용).
import { VisitPing } from "@/components/analytics/visit-ping";
// 2026-07-06 — 개인정보 제거 GA4 page_view(사주/공유 URL 의 생년월일·이름 미전송).
import { GaPageView } from "@/components/analytics/ga-page-view";
// 2026-07-06 — 자체 쿠키/분석 동의 배너 + Consent Mode v2 키 공유.
import { AnalyticsConsentBanner } from "@/components/analytics/analytics-consent-banner";
import { ANALYTICS_CONSENT_KEY } from "@/components/analytics/analytics-consent";
import "@/components/motion/motion-primitives.css";

// 2026-05-16 PR E1 — 모바일 LCP 개선. 이전엔 6 weight (400/500/600/700/800/900)
// 를 모두 로드해 한국어 폰트 페이로드가 컸다. 코드베이스 실측:
//   font-extrabold(800) 1022 · font-bold(700) 317 · font-semibold(600) 173 ·
//   font-medium(500) 71 · font-black(900) 9 · font-normal(400) 4 · font-light(300) 3
// → 400/500/700/800 4 weight 만 로드. 600/900/300 은 브라우저가 가장 가까운
// 인접 weight 로 렌더 (semibold→700, black→800, light→400) — 한국어 글리프
// 인지 차이 미미. 1022+71+317+4=1414/1602 (88%) 정확 매칭.
const brandSans = Noto_Sans_KR({
  weight: ["400", "500", "700", "800"],
  display: "swap",
  preload: false,
  variable: "--font-dalbit-sans",
});

// Redesign 2026-05-13 (Claude Design): 한자 인장(干, 子-亥) 표기용 serif.
// 라틴 + 한자 글리프만 필요하므로 weight 두 종(700·800)만 로드해 다운로드 비용 최소화.
const brandSerif = Noto_Serif_KR({
  weight: ["700", "800"],
  display: "swap",
  preload: false,
  variable: "--font-dalbit-serif",
});

// 2026-07-06 — Google Analytics 4 (gtag.js). measurement id 는 공개값(클라 노출 정상).
//   head 최상단(<head> 바로 다음)에 두는 것이 Google 권장. CSP(next.config.ts)에
//   googletagmanager / google-analytics 출처를 함께 허용해야 enforce 모드에서도 동작.
//   ⚠️ 개인정보 보호: 자동 page_view 를 끈다(send_page_view:false). 이 앱의 사주/공유
//   URL 은 경로·쿼리에 생년월일·시간·성별·이름을 담으므로(toSlug), 자동 전송하면 구글로
//   민감정보가 나간다. 대신 <GaPageView/>(client) 가 라우트 변경 시 그 값들을 제거한
//   경로만 page_view 로 보낸다. 방문/유입·페이지뷰 통계는 정상 수집.
const GA_MEASUREMENT_ID = 'G-F6BP90L8E2';

// 2026-07-06 — Consent Mode v2. 모든 태그(GTM·GA4·픽셀)보다 먼저 실행되어야 하므로
//   head 최상단(GTM 스크립트보다 앞)에 둔다. 기본을 전부 denied 로 선언하면 GA4 는
//   쿠키·광고 식별자 없이 익명 모델링만 하고, 사용자가 배너에서 '동의'를 누르면
//   applyConsent() 가 gtag('consent','update', granted) 로 승격한다(analytics-consent.ts).
//   재방문 시(localStorage 에 granted 저장됨)엔 여기서 즉시 granted 로 복원해 재노출 없이
//   정상 수집. wait_for_update 로 태그가 최대 500ms 동안 이 복원/선택을 기다렸다 발화.
const consentInitScript = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
  wait_for_update: 500
});
try {
  if (window.localStorage.getItem('${ANALYTICS_CONSENT_KEY}') === 'granted') {
    gtag('consent', 'update', {
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      analytics_storage: 'granted'
    });
  }
} catch (e) {}
`;

// gtag 스텁·dataLayer 는 consentInitScript 에서 이미 정의됨 → 여기선 js/config 만.
const gaConfigScript = `
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false });
`;

// 2026-07-06 — Google Tag Manager. <head> 최대한 위 + <body> 직후 noscript(표준 스니펫).
//   ⚠️ GTM 컨테이너 태그는 GTM 웹 UI 에서 관리된다. 컨테이너가 GA4(G-...) 태그로 자동
//   page_view 를 쏘면 위 gtag 의 send_page_view:false / GaPageView 정제가 적용되지 않고
//   URL(생년월일·이름)이 그대로 나갈 수 있다 → 개인정보 보호는 GTM UI 에서도 설정 필요.
//   또한 같은 GA4 속성을 gtag(직접)과 GTM 양쪽에서 쏘면 이중 집계된다(§둘 중 하나만).
const GTM_CONTAINER_ID = 'GTM-N9MSPMCG';
const gtmScript = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_CONTAINER_ID}');`;

const layoutModeScript = `
(() => {
  const root = document.documentElement;

  const applyPerformanceMode = () => {
    try {
      const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      const effectiveType = String(connection?.effectiveType || '');
      const saveData = connection?.saveData === true;
      const slowConnection = effectiveType === 'slow-2g' || effectiveType === '2g';
      const memory = typeof navigator.deviceMemory === 'number' ? navigator.deviceMemory : null;
      const cores = typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : null;
      const lowMemory = memory !== null && memory <= 4;
      const lowCpu = cores !== null && cores <= 4;
      const reducedMotion = motionQuery?.matches === true;

      root.dataset.motionPreference = reducedMotion ? 'reduced' : 'standard';
      root.dataset.performanceMode =
        reducedMotion || saveData || slowConnection || lowMemory || lowCpu ? 'lite' : 'standard';
    } catch {
      root.dataset.performanceMode = 'standard';
      root.dataset.motionPreference = 'standard';
    }
  };

  try {
    const mode = window.localStorage.getItem('moonlight:layout-mode-v3');
    root.dataset.appLayout = mode === 'horizontal' ? 'horizontal' : 'vertical';
    const comfort = window.localStorage.getItem('moonlight:reading-comfort-v1');
    root.dataset.readingComfort = comfort === 'large' ? 'large' : 'standard';
  } catch {
    root.dataset.appLayout = 'vertical';
    root.dataset.readingComfort = 'standard';
  }

  applyPerformanceMode();

  try {
    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (motionQuery?.addEventListener) {
      motionQuery.addEventListener('change', applyPerformanceMode);
    } else if (motionQuery?.addListener) {
      motionQuery.addListener(applyPerformanceMode);
    }

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection?.addEventListener) {
      connection.addEventListener('change', applyPerformanceMode);
    }
  } catch {}
})();
`;

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  applicationName: SITE_NAME,
  // 2026-07-05 SEO — RSS 피드 자동발견 링크(<link rel="alternate" type="application/rss+xml">).
  alternates: {
    types: {
      'application/rss+xml': '/rss.xml',
    },
  },
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  keywords: [
    "사주",
    "사주팔자",
    "사주풀이",
    "오행 분석",
    "운세",
    "명리학",
  ],
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    url: "/",
    images: [
      {
        url: "/images/gangi/og-image.png",
        width: 1200,
        height: 630,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    images: ["/images/gangi/og-image.png"],
  },
  verification: {
    google: "oi2g6kU6Sh-Ko3-4dJFPDknRw1f-SwaSLzOUa0Y43ng",
    // 2026-07-04 SEO — 네이버 서치어드바이저 소유확인. 발급 값을 Vercel env
    // NEXT_PUBLIC_NAVER_SITE_VERIFICATION 에 넣으면 meta 태그가 켜진다(미설정 시 생략).
    ...(process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION
      ? { other: { "naver-site-verification": process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION } }
      : {}),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${brandSans.variable} ${brandSerif.variable} h-full antialiased`}
      data-app-layout="vertical"
      data-motion-preference="standard"
      data-performance-mode="standard"
      data-reading-comfort="standard"
      suppressHydrationWarning
    >
      {/* 2026-05-20 — React 19/Next 16: <body> 안의 <script> 는 client 컴포넌트
          렌더 시 실행되지 않고 경고 ("Encountered a script tag while rendering
          React component") 발생. layout mode FOUC 차단용 inline script 는
          render-blocking 으로 <head> 에 두어야 한다. */}
      <head>
        {/* Consent Mode v2 — 어떤 태그(GTM·GA4)보다 먼저. 기본 denied + 재방문 복원. */}
        <script dangerouslySetInnerHTML={{ __html: consentInitScript }} />
        {/* Google Tag Manager — <head> 최대한 위(단, consent default 다음). */}
        <script dangerouslySetInnerHTML={{ __html: gtmScript }} />
        {/* Google Analytics (GA4) — gtag.js. 자동 page_view 는 끄고(send_page_view:false)
            <GaPageView/> 가 개인정보 제거한 경로만 수동 전송. */}
        <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} />
        <script dangerouslySetInnerHTML={{ __html: gaConfigScript }} />
        <script dangerouslySetInnerHTML={{ __html: layoutModeScript }} />
        {/* 2026-07-04 SEO — 사이트 아이덴티티 JSON-LD (Organization + WebSite). */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeStructuredData(buildOrganizationSchema()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeStructuredData(buildWebSiteSchema()) }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {/* Google Tag Manager (noscript) — <body> 태그 바로 뒤(표준 위치). */}
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_CONTAINER_ID}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        <GaPageView />
        <SupabaseRecoveryRedirect />
        <NotificationClickTracker />
        <ScrollResetOnNavigate />
        {children}
        <KakaoSdkLoader />
        <VisitPing />
        <AnalyticsConsentBanner />
        <AppToaster />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
