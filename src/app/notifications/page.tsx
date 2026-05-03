import type { Metadata } from 'next';
import NotificationCenterPage from '@/features/notifications/notification-center-page';
import { getNotificationSnapshot } from '@/lib/notifications';

export const metadata: Metadata = {
  title: '알림 센터',
  description: '푸시 알림, 홈 위젯, 재방문 리텐션 흐름을 한곳에서 관리하는 달빛인생의 알림 센터입니다.',
  alternates: {
    canonical: '/notifications',
  },
};

export default async function NotificationsPage() {
  const snapshot = await getNotificationSnapshot();

  return <NotificationCenterPage mode="center" snapshot={snapshot} />;
}
