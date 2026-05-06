import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: '알림',
  description: '오늘운세, 오늘타로, 오늘띠 알림 설정 화면으로 이동합니다.',
  alternates: {
    canonical: '/notifications/widget',
  },
};

export default async function NotificationWidgetPage() {
  redirect('/notifications');
}
