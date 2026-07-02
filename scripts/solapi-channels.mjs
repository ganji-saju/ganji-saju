// Solapi 연동된 카카오 채널(발신프로필) 목록 조회 → pfId 확인용 1회성 도구.
// 사용:
//   SOLAPI_API_KEY=발급키 SOLAPI_API_SECRET=발급시크릿 node scripts/solapi-channels.mjs
//
// 출력의 각 채널 항목에서:
//   - channelId / pfId   → SOLAPI_KAKAO_PFID 에 넣을 값 (보통 KA01PF... 형태)
//   - searchId (@_xxxxx) → NEXT_PUBLIC_KAKAO_CHANNEL_ID (채널추가 버튼용, 선택)
import crypto from 'node:crypto';

const apiKey = process.env.SOLAPI_API_KEY;
const apiSecret = process.env.SOLAPI_API_SECRET;
if (!apiKey || !apiSecret) {
  console.error('환경변수 필요: SOLAPI_API_KEY, SOLAPI_API_SECRET');
  console.error('예) SOLAPI_API_KEY=xxx SOLAPI_API_SECRET=yyy node scripts/solapi-channels.mjs');
  process.exit(1);
}

const date = new Date().toISOString();
const salt = crypto.randomBytes(32).toString('hex');
const signature = crypto.createHmac('sha256', apiSecret).update(date + salt).digest('hex');
const authorization = `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;

const res = await fetch('https://api.solapi.com/kakao/v2/channels', {
  headers: { Authorization: authorization },
});
const text = await res.text();
let data;
try {
  data = JSON.parse(text);
} catch {
  console.error(`HTTP ${res.status} — 응답 파싱 실패:\n${text}`);
  process.exit(1);
}

if (!res.ok) {
  console.error(`HTTP ${res.status}`);
  console.error(JSON.stringify(data, null, 2));
  process.exit(1);
}

const list = Array.isArray(data) ? data : (data.channelList ?? data.channels ?? []);
if (!list.length) {
  console.log('연동된 카카오 채널이 없습니다. (Solapi 콘솔에서 채널 연동 먼저)');
  console.log('원본 응답:', JSON.stringify(data, null, 2));
  process.exit(0);
}

console.log(`연동된 채널 ${list.length}개:\n`);
for (const ch of list) {
  console.log('— 채널:', ch.name ?? ch.channelName ?? '(이름없음)');
  console.log('  pfId(SOLAPI_KAKAO_PFID):', ch.channelId ?? ch.pfId ?? '(필드 확인 필요)');
  console.log('  검색용 ID(NEXT_PUBLIC_KAKAO_CHANNEL_ID):', ch.searchId ?? ch.searchableId ?? '(없음)');
  console.log('  상태:', ch.status ?? '');
  console.log('');
}
console.log('전체 원본(필드명 확인용):');
console.log(JSON.stringify(list[0], null, 2));
