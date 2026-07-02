// 카카오 채널 추가(친구톡 도달 조건 = 채널 친구). SDK 가용 시 addChannel 팝업,
// 아니면 채널 추가 페이지 URL 로 폴백. 채널 ID 미설정이면 no-op.
export const kakaoChannelId = process.env.NEXT_PUBLIC_KAKAO_CHANNEL_ID ?? '';

/** 채널 추가 실행. 채널 ID 미설정이면 false. */
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
