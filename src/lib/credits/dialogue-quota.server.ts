// 2026-09-01 — 대화방 하단 "남은 질문 N회" 의 **최초 표시값**.
//   턴이 오간 뒤엔 /api/ai 응답의 billing.questionsRemaining 이 이어받는다(같은 계산식).
//   여기서만 서버 세션·DB 를 읽고, 이후 갱신은 응답 페이로드로 한다.
import 'server-only';
import { getCredits } from '@/lib/credits/deduct';
import {
  MEMBER_BENEFIT_KEYS,
  MEMBER_QUOTAS,
  dailyPeriodKey,
  getMemberBenefitUsed,
} from '@/lib/credits/member-benefits';
import {
  getAiChatQuestionsRemaining,
  getAiChatSuccessfulTurns,
  getAiChatTurnPlan,
  getAvailableCreditsTotal,
} from '@/lib/credits/ai-chat-access';
import { createClient, hasSupabaseServerEnv } from '@/lib/supabase/server';
import { getMemberTier } from '@/lib/subscription';

export interface DialogueQuota {
  /** member = 멤버십 오늘치 / pass = 990원 질문권(전) */
  kind: 'member' | 'pass';
  remaining: number;
}

/** 비로그인·env 부재·조회 실패는 null — 표시를 생략할 뿐, 게이트는 서버가 따로 한다. */
export async function getViewerDialogueQuota(): Promise<DialogueQuota | null> {
  if (!hasSupabaseServerEnv) return null;

  try {
    const {
      data: { user },
    } = await (await createClient()).auth.getUser();
    if (!user) return null;

    if ((await getMemberTier(user.id)) === 'premium') {
      const limit = MEMBER_QUOTAS.premium.dialogueDaily;
      const used = await getMemberBenefitUsed(
        user.id,
        MEMBER_BENEFIT_KEYS.dialogueDaily.benefit,
        dailyPeriodKey()
      );
      // 오늘치를 다 써도 전 잔액이 있으면 이어 쓸 수 있다(번들 과금 폴백) — 합산해 보여준다.
      const credits = getAvailableCreditsTotal(await getCredits(user.id));
      return {
        kind: 'member',
        remaining: getAiChatQuestionsRemaining(credits, {
          freeTurnsRemaining: Math.max(0, limit - used),
        }),
      };
    }

    const plan = getAiChatTurnPlan(await getAiChatSuccessfulTurns(user.id));
    const credits = getAvailableCreditsTotal(await getCredits(user.id));
    return {
      kind: 'pass',
      remaining: getAiChatQuestionsRemaining(credits, {
        // ⚠️ plan 은 **다음 턴** 계획이다. 다음 턴이 묶음 첫 턴(charged_bundle)이면 지금
        //   공짜로 물어볼 수 있는 건 0 이고(전 3개를 먼저 내야 한다), 묶음 중간이면
        //   "다음 턴 + 그 뒤 잔여" 만큼 남아 있다. 응답 경로(턴 처리 후)와 의미가
        //   한 칸 어긋나므로 여기서 맞춰 넘긴다.
        bundleTurnsRemaining:
          plan.status === 'charged_bundle' ? 0 : plan.bundleTurnsRemaining + 1,
      }),
    };
  } catch {
    return null;
  }
}
