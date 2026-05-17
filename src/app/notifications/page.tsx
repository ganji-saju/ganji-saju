import type { Metadata } from 'next';
import { StarSignDailyDigestCard } from '@/components/star-sign/star-sign-daily-digest-card';
import NotificationCenterPage from '@/features/notifications/notification-center-page';
import { getNotificationSnapshot } from '@/lib/notifications';

export const metadata: Metadata = {
  title: '알림',
  description: '오늘 별자리 일진과 오늘운세·타로·띠 알림을 한 화면에서 확인하는 간지사주 알림 센터입니다.',
  alternates: {
    canonical: '/notifications',
  },
};

export default async function NotificationsPage() {
  const snapshot = await getNotificationSnapshot();

  // 2026-05-16 PR #133 — 오늘 별자리 일진 카드를 server-render 후 client 페이지에 slot 으로 전달.
  // StarSignDailyDigestCard 는 computeStarSignDailyDigest() 만 호출하므로 server 에서 안전.
  return (
    <NotificationCenterPage
      mode="center"
      snapshot={snapshot}
      headerSlot={<StarSignDailyDigestCard />}
    />
  );
}
