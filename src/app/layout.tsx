import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Noto_Sans_KR, Noto_Serif_KR } from "next/font/google";
import "./globals.css";
import SupabaseRecoveryRedirect from "@/components/auth/supabase-recovery-redirect";
import { DEFAULT_DESCRIPTION, SITE_NAME, getSiteUrl } from "@/lib/site";
// 2026-05-15 handoff PR-J: 57 m-toast — 전역 토스트 인프라.
import { AppToaster } from "@/components/notifications/app-toaster";
import "@/components/motion/motion-primitives.css";

const brandSans = Noto_Sans_KR({
  weight: ["400", "500", "600", "700", "800", "900"],
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
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
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
      className={`${brandSans.variable} ${brandSerif.variable} h-full antialiased`}
      data-app-layout="vertical"
      data-reading-comfort="standard"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: layoutModeScript }} />
        <SupabaseRecoveryRedirect />
        {children}
        <AppToaster />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
