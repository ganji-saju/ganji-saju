// 2026-06-30 — 코인 sunset 후: 레거시 결제코인 잔액 보유자에게만 코인옵션을 노출하기 위한 판정.
//   balance(비만료 결제 lot 합)만 본다 — subscription_balance(멤버 적립)는 제외(멤버에게 코인옵션 미노출).
import { getCredits } from '@/lib/credits/deduct';

export async function userHasLegacyCoins(userId: string): Promise<boolean> {
  if (!userId) return false;
  const c = await getCredits(userId);
  return (c?.balance ?? 0) > 0;
}
