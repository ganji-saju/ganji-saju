import type { Metadata } from 'next';
import NotificationCenterPage from '@/features/notifications/notification-center-page';
import { getNotificationSnapshot } from '@/lib/notifications';

export const metadata: Metadata = {
  title: '알림',
  description: '오늘운세, 오늘타로, 오늘띠 알림만 간단히 켜고 끄는 달빛인생 알림 화면입니다.',
  alternates: {
    canonical: '/notifications',
  },
};

export default async function NotificationsPage() {
  const snapshot = await getNotificationSnapshot();

  return <NotificationCenterPage mode="center" snapshot={snapshot} />;
}
