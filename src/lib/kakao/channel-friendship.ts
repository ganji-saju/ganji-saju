// 카카오 `GET /v1/api/talk/channels` 응답의 순수 파싱 — 우리 채널(친구톡 발신 채널)을
// 사용자가 실제로 '추가'했는지 판정한다. 카카오 API 호출/네트워크 에러 처리는 라우트
// (coupon-verify)의 책임이고, 이 함수는 이미 받은 JSON만 방어적으로 파싱한다.
//
// ⚠️ 검증필요 — 카카오 공식 문서 기준 응답 형태(실 응답으로 재확인 권장):
//   { channels: [ { channel_public_id: '_xxxx', relation: 'added' | 'none', ... } ] }
// null/undefined/누락/타입불일치 등 스키마가 어긋나도 절대 throw 하지 않고 false 를 반환한다
// (친구여부 미확인 = 친구 아님으로 안전하게 처리 — 오탐으로 쿠폰을 잘못 발급하지 않는다).

interface KakaoChannelEntry {
  channel_public_id?: unknown;
  relation?: unknown;
}

interface KakaoChannelsResponse {
  channels?: unknown;
}

/**
 * `channelsApiJson`(카카오 channels API 응답)에서 `targetChannelPublicId` 채널이
 * `relation === 'added'` 상태로 존재하는지 판정한다.
 */
export function isChannelFriend(channelsApiJson: unknown, targetChannelPublicId: string): boolean {
  if (!targetChannelPublicId) return false;
  if (!channelsApiJson || typeof channelsApiJson !== 'object') return false;

  const { channels } = channelsApiJson as KakaoChannelsResponse;
  if (!Array.isArray(channels)) return false;

  return channels.some((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const { channel_public_id: publicId, relation } = entry as KakaoChannelEntry;
    return publicId === targetChannelPublicId && relation === 'added';
  });
}
