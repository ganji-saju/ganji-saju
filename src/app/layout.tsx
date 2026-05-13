import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import SupabaseRecoveryRedirect from "@/components/auth/supabase-recovery-redirect";
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  DEFAULT_OG_IMAGE_HEIGHT,
  DEFAULT_OG_IMAGE_WIDTH,
  SITE_NAME,
  getSiteUrl,
} from "@/lib/site";

// P1-7 fix (audit 2026-05-13): 코드베이스 grep 결과 font-weight 900 사용 0건이라
// 6 weight → 5 weight 로 축소 (Korean glyph subset download 절감, 모바일 LCP 개선).
// 800 은 main 의 redesign 후속에서 일부 hero 카피가 사용 — 보존.
// 잔여 weight 변수(--app-type-body: 450, --app-type-button: 650)는 브라우저가
// 인접 weight(400/700) 로 자동 보간해 시각 영향 거의 없음.
const brandSans = Noto_Sans_KR({
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  preload: false,
  variable: "--font-dalbit-sans",
});

const layoutModeScript = `
(() => {
  try {
    const mode = window.localStorage.getItem('moonlight:layout-mode-v3');
    document.documentElement.dataset.appLayout = mode === 'horizontal' ? 'horizontal' : 'vertical';
    const comfort = window.localStorage.getItem('moonlight:reading-comfort-v1');
    document.documentElement.dataset.readingComfort = comfort === 'large' ? 'large' : 'standard';
  } catch {
    document.documentElement.dataset.appLayout = 'vertical';
    document.documentElement.dataset.readingComfort = 'standard';
  }
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
  // P1-4 fix (audit 2026-05-13): default OG/Twitter 카드에 images 명시.
  // 페이지별 openGraph 가 명시되지 않은 경우의 fallback. 페이지의 openGraph 는
  // layout 의 openGraph 를 replace 하므로, 각 핵심 페이지는 buildOpenGraph() 를 사용한다.
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    url: "/",
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: DEFAULT_OG_IMAGE_WIDTH,
        height: DEFAULT_OG_IMAGE_HEIGHT,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
  verification: {
    google: "oi2g6kU6Sh-Ko3-4dJFPDknRw1f-SwaSLzOUa0Y43ng",
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
      className={`${brandSans.variable} h-full antialiased`}
      data-app-layout="vertical"
      data-reading-comfort="standard"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: layoutModeScript }} />
        <SupabaseRecoveryRedirect />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
