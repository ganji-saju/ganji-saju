// 2026-06-05 Bug fix — 오늘운세 hero 가 "달빛이님" 으로 나오던 이슈.
//   원인: 오늘운세 입력은 이름을 받지 않고 profile.display_name 만 주입(PR #166).
//   display_name 이 비면 userName=null → hero 가 '달빛이' 브랜드 fallback 노출.
//   보강: display_name 다음으로 소셜 로그인 메타데이터(name/full_name/nickname)도 본다.
//   ※ 표시 전용(인증·권한 판단 아님)이라 변조 가능한 user_metadata 사용 허용.
export interface TodayDisplayNameSources {
  profileDisplayName?: string | null;
  /** Supabase user.user_metadata (소셜 로그인 제공 이름). */
  authMetadata?: Record<string, unknown> | null;
  /** 클라이언트가 직접 보낸 이름(비로그인 닉네임 입력 대비). */
  clientName?: unknown;
}

const AUTH_NAME_KEYS = ['name', 'full_name', 'nickname', 'user_name'] as const;

/**
 * 오늘운세 hero 인사말용 표시 이름 resolution(순수).
 * 우선순위: profile.display_name → 소셜 메타데이터 → 클라이언트 입력.
 * 모두 비면 undefined → hero 는 '달빛이' fallback.
 */
export function resolveTodayDisplayName(sources: TodayDisplayNameSources): string | undefined {
  const candidates: unknown[] = [sources.profileDisplayName];
  const meta = sources.authMetadata;
  if (meta) {
    for (const key of AUTH_NAME_KEYS) candidates.push(meta[key]);
  }
  candidates.push(sources.clientName);

  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed) return trimmed;
    }
  }
  return undefined;
}
