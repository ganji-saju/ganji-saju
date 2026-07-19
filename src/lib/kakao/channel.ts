// 카카오 채널 추가(친구톡 도달 조건 = 채널 친구). SDK 가용 시 addChannel 팝업,
// 아니면 채널 추가 페이지 URL 로 폴백. 채널 ID 미설정이면 no-op.

/**
 * 카카오 채널 **공개 ID** 형식 — `_` + 영숫자.
 *
 * 2026-07-20 — 사용자 제보: "채널 추가하고 소식 받기를 누르면 찾을 수 없는 페이지".
 *   원인은 코드가 아니라 값이었다. `NEXT_PUBLIC_KAKAO_CHANNEL_ID` 에 공개 ID 대신
 *   **채널 이름('간지사주')** 이 들어가 있어 `https://pf.kakao.com/간지사주/friend` 로 이동했다.
 *   공개 ID 는 카카오 비즈니스 콘솔의 채널 URL 뒤쪽 `_` 로 시작하는 문자열이다.
 *
 *   env 오설정을 코드가 못 알아채면 사용자는 깨진 링크를 밟는다 — 형식을 검증해
 *   맞지 않으면 **미설정과 동일 취급**(버튼 미노출)한다. 깨진 버튼보다 없는 버튼이 낫다.
 *   같은 계열의 사고: NEXT_PUBLIC_SITE_URL 오설정으로 방문 집계가 전멸했던 건(5a06e9c3).
 */
const CHANNEL_PUBLIC_ID_RE = /^_[A-Za-z0-9]+$/;

export function isValidKakaoChannelId(value: string | null | undefined): boolean {
  return CHANNEL_PUBLIC_ID_RE.test(String(value ?? '').trim());
}

const rawChannelId = (process.env.NEXT_PUBLIC_KAKAO_CHANNEL_ID ?? '').trim();

/** 형식이 맞을 때만 노출. 잘못된 값은 미설정으로 본다(깨진 링크 차단). */
export const kakaoChannelId = isValidKakaoChannelId(rawChannelId) ? rawChannelId : '';

if (process.env.NODE_ENV !== 'production' && rawChannelId && !kakaoChannelId) {
  console.warn(
    `[kakao] NEXT_PUBLIC_KAKAO_CHANNEL_ID 형식이 올바르지 않습니다: "${rawChannelId}". ` +
      '채널 이름이 아니라 카카오 비즈니스 콘솔의 공개 ID(_ 로 시작)를 넣어야 합니다.'
  );
}

/** 채널 추가 실행. 채널 ID 미설정(또는 형식 오류)이면 false. */
export function addKakaoChannel(): boolean {
  if (!kakaoChannelId || typeof window === 'undefined') return false;
  const kakao = window.Kakao;
  if (kakao?.Channel && kakao.isInitialized()) {
    kakao.Channel.addChannel({ channelPublicId: kakaoChannelId });
    return true;
  }
  // SDK 미가용 → 채널 추가 페이지로 이동.
  window.open(`https://pf.kakao.com/${kakaoChannelId}/friend`, '_blank', 'noopener,noreferrer');
  return true;
}
