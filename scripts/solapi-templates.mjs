// Solapi 알림톡 템플릿 목록 조회 → 템플릿 ID·이름·심의상태 확인용 1회성 도구.
// 사용:
//   SOLAPI_API_KEY=발급키 SOLAPI_API_SECRET=발급시크릿 node scripts/solapi-templates.mjs
//
// 출력의 각 템플릿에서:
//   - templateId (KA01TP...)  → KAKAO_TPL_PAYMENT_COMPLETE / KAKAO_TPL_SUBSCRIPTION_EXPIRING 에 넣을 값
//   - status = APPROVED(승인) 인 템플릿만 실제 발송 가능
//
// (선택) 특정 발신프로필만 보려면: SOLAPI_KAKAO_PFID 도 함께 넘기면 필터링.
import crypto from 'node:crypto';

const apiKey = process.env.SOLAPI_API_KEY;
const apiSecret = process.env.SOLAPI_API_SECRET;
const pfId = process.env.SOLAPI_KAKAO_PFID; // 선택
if (!apiKey || !apiSecret) {
  console.error('환경변수 필요: SOLAPI_API_KEY, SOLAPI_API_SECRET');
  console.error('예) SOLAPI_API_KEY=xxx SOLAPI_API_SECRET=yyy node scripts/solapi-templates.mjs');
  process.exit(1);
}

const date = new Date().toISOString();
const salt = crypto.randomBytes(32).toString('hex');
const signature = crypto.createHmac('sha256', apiSecret).update(date + salt).digest('hex');
const authorization = `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;

const url = new URL('https://api.solapi.com/kakao/v2/templates');
url.searchParams.set('limit', '100');
if (pfId) url.searchParams.set('pfId', pfId);

const res = await fetch(url, { headers: { Authorization: authorization } });
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

const list = Array.isArray(data)
  ? data
  : (data.templateList ?? data.list ?? data.templates ?? []);
if (!list.length) {
  console.log('등록된 알림톡 템플릿이 없습니다. (Solapi 콘솔에서 템플릿 등록·심의 먼저)');
  console.log('원본 응답:', JSON.stringify(data, null, 2));
  process.exit(0);
}

console.log(`알림톡 템플릿 ${list.length}개:\n`);
for (const t of list) {
  const status = t.status ?? '';
  const mark = String(status).toUpperCase().includes('APPROV') ? '✅ 승인' : `⏳ ${status}`;
  console.log('—', t.name ?? t.templateName ?? '(이름없음)', `[${mark}]`);
  console.log('  templateId(→ KAKAO_TPL_*):', t.templateId ?? t.id ?? '(필드 확인 필요)');
  console.log('');
}
console.log('참고: 결제완료 템플릿 ID → KAKAO_TPL_PAYMENT_COMPLETE');
console.log('      멤버십만료 템플릿 ID → KAKAO_TPL_SUBSCRIPTION_EXPIRING');
console.log('\n전체 원본(필드명 확인용):');
console.log(JSON.stringify(list[0], null, 2));
