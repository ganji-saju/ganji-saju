import { MOONLIGHT_FALLBACK_DISPLAY_NAME } from '@/lib/today-fortune/resolve-display-name';

/**
 * 과거 today_fortune_result_snapshots 백필 결정(순수).
 * free_result_json.userName 을 실명으로 교정할지/무엇으로 할지 판단한다.
 *
 * @param currentUserName 스냅샷에 저장된 현재 userName (null/빈값/'달빛이'/실명)
 * @param resolvedName    현재 프로필·소셜에서 새로 해석된 이름(없으면 빈값)
 * @returns 새로 써야 할 이름. 변경 불필요면 null.
 *
 * 규칙:
 * - 이미 실명이 저장돼 있으면(비어있지 않고 '달빛이'가 아님) 보존 → null.
 * - 그 외(null/빈값/'달빛이') + 해석된 실명이 있고 기존과 다르면 그 이름.
 * - 해석된 실명이 없으면 그대로 둠(렌더 시 '달빛이' fallback 유지) → null.
 */
export function resolveBackfillUserName(
  currentUserName: string | null | undefined,
  resolvedName: string | null | undefined
): string | null {
  const current = currentUserName?.trim() ?? '';
  if (current && current !== MOONLIGHT_FALLBACK_DISPLAY_NAME) return null;
  const resolved = resolvedName?.trim() ?? '';
  if (resolved && resolved !== current) return resolved;
  return null;
}
