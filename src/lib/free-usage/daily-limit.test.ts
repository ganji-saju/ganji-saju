import assert from 'node:assert/strict';
import { FREE_DAILY_SURFACES, freeDailyLimitMessage, type FreeSurface } from './daily-limit';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

// 2026-07-18 — 조사(은/는)를 하드코딩하면 '꿈해몽는' 같은 비문이 그대로 사용자에게 나간다.
//   라벨이 바뀔 수 있으므로 실제 조립된 문장을 검증한다.
test('freeDailyLimitMessage: 받침 유무에 따라 은/는 조사 선택', () => {
  assert.equal(
    freeDailyLimitMessage('today'),
    '간단운세는 하루 한 번 볼 수 있어요. 내일 다시 만나요.'
  );
  assert.equal(
    freeDailyLimitMessage('tarot'),
    '딱 3장 타로는 하루 한 번 볼 수 있어요. 내일 다시 만나요.'
  );
  // 받침 ㅇ → '은'
  assert.equal(
    freeDailyLimitMessage('dream'),
    '한 단어 꿈해몽은 하루 한 번 볼 수 있어요. 내일 다시 만나요.'
  );
  // 받침 ㅁ → '은'
  assert.equal(
    freeDailyLimitMessage('dialogue'),
    '질문 하나 대화상담은 하루 한 번 볼 수 있어요. 내일 다시 만나요.'
  );
});

test('freeDailyLimitMessage: 라벨 뒤 조사가 받침 규칙과 일치', () => {
  for (const surface of Object.keys(FREE_DAILY_SURFACES) as FreeSurface[]) {
    const { label } = FREE_DAILY_SURFACES[surface];
    const msg = freeDailyLimitMessage(surface);
    const code = label.trim().slice(-1).charCodeAt(0);
    const hasBatchim = code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
    // 받침 있으면 '은', 없으면 '는'이 라벨 바로 뒤에 와야 한다.
    assert.ok(
      msg.startsWith(`${label}${hasBatchim ? '은' : '는'} `),
      `조사 조립 실패: ${msg}`
    );
    assert.ok(msg.endsWith('내일 다시 만나요.'), msg);
  }
});

test('FREE_DAILY_SURFACES: 쿠키·benefit 키가 표면마다 고유', () => {
  const cookies = Object.values(FREE_DAILY_SURFACES).map((s) => s.cookie);
  const benefits = Object.values(FREE_DAILY_SURFACES).map((s) => s.benefit);
  assert.equal(new Set(cookies).size, cookies.length);
  assert.equal(new Set(benefits).size, benefits.length);
});
