// 2026-05-14: 13개 모션 보드 QA gallery.
// /admin 하위라 robots disallow 적용됨 (이미 robots.ts 에 /admin 등록).
// production 화면에 들어가는 motion primitive 의 통합 QA 화면.
import type { Metadata } from 'next';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';
import { MotionGalleryClient } from './gallery-client';
import '@/components/motion/motion-primitives.css';

export const metadata: Metadata = {
  title: '모션 갤러리 · 13 보드 QA',
  description: '간지사주 리디자인 핸드오프의 모션 보드 13종을 한 화면에서 검수.',
  robots: { index: false, follow: false },
};

export default function MotionGalleryPage() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="모션 갤러리" backHref="/admin/saju-verify" />
        <MotionGalleryClient />
      </AppPage>
    </AppShell>
  );
}
