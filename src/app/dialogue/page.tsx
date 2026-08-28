// 2026-08-28 — 허브(선생 9명 중 고르는 화면)를 없애고 **바로 대화방으로** 보낸다.
//
//   그전 이 페이지는 선생 9명 카드 + 예약 배너를 그렸는데, 9장이 전부 같은 대화방
//   (`/dialogue/<id>`)으로 갈라질 뿐이라 "무엇을 고르는지" 모른 채 한 번 더 누르게 했다.
//   선택지가 아니라 관문이었다.
//
//   보관: 선생 12명 라우트(`/dialogue/[expert]`)와 `/dialogue/appointment` 는 그대로 산다.
//   `?expert=tiger` 로 지정하면 그 선생 방으로 들어간다 — 지정이 없으면 기본 선생.
import { redirect } from 'next/navigation';
import {
  DEFAULT_DIALOGUE_EXPERT_ID,
  normalizeDialogueExpertId,
} from '@/lib/dialogue-experts';
import { guardLockedFreeEntry } from '@/lib/paywall-lockdown.server';
import { guardMenuPassEntry } from '@/lib/payments/menu-pass.server';

// 2026-08-28 — 정적 프리렌더 금지. 이 페이지는 렌더할 본문이 없어서(항상 redirect)
//   Next 가 정적으로 확정하기 쉬운 모양이 됐다. 실제로 로컬 빌드는 `○`(static) 로 잡고
//   `.next/server/app/dialogue.meta` 에 `status: 307 → /pricing` 을 구웠다.
//
//   그 자체는 **로컬 아티팩트**다: 로컬엔 Supabase env 가 없어 가드가 쿠키를 안 읽고,
//   그래서 동적 전환이 안 일어난다(Vercel 은 env 가 있어 `createClient()` → `cookies()`
//   에서 ƒ 로 떨어진다 — /tarot/daily·/dream 도 같은 이유로 로컬에선 ○ 다).
//   다만 "가드가 우연히 쿠키를 읽어서 동적이 된다"에 결제 게이트를 기대는 건 위험하다.
//   결제자 통과 판정이 캐시된 307 뒤에 갇히면 **돈 낸 사람이 /pricing 으로 튕긴다**.
export const dynamic = 'force-dynamic';

const PASSTHROUGH = ['question', 'sourceSessionId', 'concern', 'from', 'autoStart'] as const;

export default async function DialogueEntryPage({
  searchParams,
}: {
  searchParams: Promise<Partial<Record<(typeof PASSTHROUGH)[number] | 'expert', string>>>;
}) {
  // 전면 유료화 잠금 — 무료 1문답 진입 차단(결제 이력 있으면 통과).
  //   대화방(`/dialogue/[expert]`)에도 같은 가드가 있지만, `isFreeEntryPath('/dialogue')`
  //   가 true 인 이상 이 경로에서 바로 걸러야 리다이렉트가 한 번으로 끝난다.
  await guardLockedFreeEntry();
  // 2026-08-25 — 990원 라이트 언락(대화상담).
  await guardMenuPassEntry('dialogue', 'dialogue-hub');

  const params = await searchParams;
  const expertId = normalizeDialogueExpertId(params.expert) ?? DEFAULT_DIALOGUE_EXPERT_ID;

  const query = new URLSearchParams();
  for (const key of PASSTHROUGH) {
    if (params[key]) query.set(key, params[key]!);
  }
  const search = query.toString();

  redirect(`/dialogue/${expertId}${search ? `?${search}` : ''}`);
}
