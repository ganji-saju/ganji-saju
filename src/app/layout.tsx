import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Noto_Sans_KR } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { DEFAULT_DESCRIPTION, SITE_NAME, getSiteUrl } from "@/lib/site";

const brandSans = Noto_Sans_KR({
  weight: ["400", "500", "600", "700", "800", "900"],
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
      className={`${brandSans.variable} h-full antialiased`}
      data-app-layout="vertical"
      data-reading-comfort="standard"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: layoutModeScript }} />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
