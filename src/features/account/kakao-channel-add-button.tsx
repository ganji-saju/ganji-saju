// 카카오 채널 추가 버튼. 채널 ID(NEXT_PUBLIC_KAKAO_CHANNEL_ID) 미설정이면 렌더 안 함.
// 친구톡(광고) 소식은 채널 친구에게만 도달하므로, 광고 수신동의와 함께 채널 추가를 유도.
'use client';

import { addKakaoChannel, kakaoChannelId } from '@/lib/kakao/channel';

export function KakaoChannelAddButton() {
  if (!kakaoChannelId) return null;
  return (
    <button
      type="button"
      onClick={() => addKakaoChannel()}
      className="mt-2 w-full rounded-[10px] border px-3 py-2.5 text-[14px] font-extrabold"
      style={{
        background: '#fee500',
        borderColor: 'rgba(0,0,0,0.06)',
        color: '#191919',
      }}
    >
      카카오 채널 추가하고 소식 받기
    </button>
  );
}
