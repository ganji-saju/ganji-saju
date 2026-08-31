// 2026-06-05 Bug fix — 오늘운세 hero 가 "달빛이님" 으로 나오던 이슈.
//   원인: 오늘운세 입력은 이름을 받지 않고 profile.display_name 만 주입(PR #166).
//   display_name 이 비면 userName=null → hero 가 '달빛이' 브랜드 fallback 노출.
//   보강: display_name 다음으로 소셜 로그인 메타데이터(name/full_name/nickname)도 본다.
//   ※ 표시 전용(인증·권한 판단 아님)이라 변조 가능한 user_metadata 사용 허용.
export interface TodayDisplayNameSources {
  profileDisplayName?: string | null;
  /** Supabase user.user_metadata (소셜 로그인 제공 이름). */
  authMetadata?: Record<string, unknown> | null;
  /** 이번 폼이 명시한 이름(가족 칩으로 채우면 그 가족 이름) — 대상자 지목이라 최우선. */
  clientName?: unknown;
}

const AUTH_NAME_KEYS = ['name', 'full_name', 'nickname', 'user_name'] as const;

/**
 * 표시 이름이 전혀 없을 때의 '달빛이' 브랜드 fallback — 단일 상수.
 * surface 마다 raw `?? '달빛이'` 리터럴을 흩뿌리면 한 곳을 고쳐도 다른 데서 재발(blind spot)하므로
 * 모든 이름 fallback 은 이 상수를 import 해 사용한다(가드: display-name-blindspot.test.ts).
 */
export const MOONLIGHT_FALLBACK_DISPLAY_NAME = '달빛이';

/**
 * 오늘운세 hero 인사말용 표시 이름 resolution(순수).
 * 우선순위: **이번 폼이 보낸 이름 → profile.display_name → 소셜 메타데이터.**
 * 모두 비면 undefined → hero 는 '달빛이' fallback.
 *
 * 2026-08-31 순서 반전 — 폼 이름이 최후순위라 가족 사주를 조회해도 계정 주인 이름이
 *   이겼다("가족 오늘운세인데 내 이름이 뜬다" 제보). 2026-06-05 의 '달빛이' 회귀는
 *   순서 문제가 아니라 payload 에 이름 필드가 아예 없어서였고, 지금도 빈 값은 건너뛰므로
 *   폼 이름이 없으면 그대로 프로필→소셜로 폴백한다(그 가드는 유지된다).
 */
export function resolveTodayDisplayName(sources: TodayDisplayNameSources): string | undefined {
  const candidates: unknown[] = [sources.clientName, sources.profileDisplayName];
  const meta = sources.authMetadata;
  if (meta) {
    for (const key of AUTH_NAME_KEYS) candidates.push(meta[key]);
  }

  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed) return trimmed;
    }
  }
  return undefined;
}
