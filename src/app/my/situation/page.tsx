// 2026-05-16 PR #151 (B2) — /my/situation 입력값 수정 전용 페이지.
// 매번 사주를 새로 입력하지 않고도 default 상황을 갱신할 수 있도록 별도 메뉴.
// 저장된 값은 새 reading 시 situation_json 의 fallback 으로 사용됨.
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';
import { getUserSituationForUser } from '@/lib/profile/user-situation';
import { createClient } from '@/lib/supabase/server';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { MySituationForm } from './my-situation-form';

export const metadata: Metadata = {
  title: '내 현재 상황',
  description: '연애·직업·고민을 저장해두면 다음 풀이부터 자동 반영됩니다.',
};

export default async function MySituationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login?next=/my/situation');
  }
  const initialSituation = await getUserSituationForUser(supabase, user.id);

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="내 현재 상황" backHref="/my" />
        <MySituationForm initialSituation={initialSituation} />
      </AppPage>
    </AppShell>
  );
}
