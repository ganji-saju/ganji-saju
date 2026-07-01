import type { Metadata } from 'next';
import SiteHeader from '@/features/shared-navigation/site-header';
import AccountShellNav from '@/features/account/account-shell-nav';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

export const metadata: Metadata = {
  title: 'MY',
  description: '사주 결과, 전 잔액, 결제 및 구독 상태를 관리하는 개인 공간입니다.',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function MyLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell">
      <AppPage className="gangi-subpage space-y-6 lg:space-y-8">
        <AccountShellNav />
        {children}
      </AppPage>
    </AppShell>
  );
}
