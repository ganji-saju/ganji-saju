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
        <SupabaseRecoveryRedirect />
        <NotificationClickTracker />
        <ScrollResetOnNavigate />
        {children}
        <KakaoSdkLoader />
        <VisitPing />
        <AppToaster />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
