// 올해운 노트 — 생년월일 입력(설계 §3-3). 파트너 쿠키가 없거나 비활성이면 안내만(정가 결제로 가지 않게).
import { cookies } from 'next/headers';
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import { getActivePartner, PARTNER_COOKIE } from '@/lib/partners/partner';
import { NOTE_TITLE_STYLE, NoteNotice } from '@/features/partner-theme/note-theme';
import { PartnerBirthFormView } from './partner-birth-form';

export const dynamic = 'force-dynamic';

export default async function PartnerStartPage() {
  const partner = hasSupabaseServiceEnv
    ? await getActivePartner(await createServiceClient(), (await cookies()).get(PARTNER_COOKIE)?.value)
    : null;
  if (!partner) return <NoteNotice title="지금은 이용할 수 없는 링크입니다." />;
  return (
    <>
      <h1 style={NOTE_TITLE_STYLE} className="text-[26px] font-extrabold leading-[1.35]">생년월일을 알려 주세요</h1>
      <p className="mb-5 mt-2 text-[16px] leading-[1.7] text-[var(--note-muted)]">2027년 한 해 흐름을 이 정보로 정리해 드려요.</p>
      <PartnerBirthFormView />
    </>
  );
}
