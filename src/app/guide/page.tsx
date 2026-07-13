import type { Metadata } from 'next';
import { SystemGuidePage } from '@/features/system-guide/system-guide-page';

export const metadata: Metadata = {
  title: '사용방법',
  description: '간지사주의 프로필, 무료운세, 사주풀이, 저장 결과, 대화, 알림 사용방법',
};

export default function GuidePage() {
  return <SystemGuidePage />;
}
