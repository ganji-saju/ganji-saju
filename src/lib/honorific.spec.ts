import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getHonorificLabel } from './honorific';
import { personalizeNotificationBody } from './web-push';

describe('getHonorificLabel (server-safe)', () => {
  it('빈 이름은 기본 호칭', () => expect(getHonorificLabel('  ')).toBe('선생님'));
  it('이름 뒤에 선생님', () => expect(getHonorificLabel('영민')).toBe('영민 선생님'));
  it('이미 님으로 끝나면 그대로', () => expect(getHonorificLabel('영민님')).toBe('영민님'));
  it('푸시 본문 개인화가 서버 모듈만으로 동작', () =>
    expect(personalizeNotificationBody('선생님, 오늘의 흐름', '영민')).toBe('영민 선생님, 오늘의 흐름'));
  it("honorific.ts 와 web-push.ts 는 'use client' 모듈을 import 하지 않는다", () => {
    for (const f of ['honorific.ts', 'web-push.ts']) {
      const src = readFileSync(join(__dirname, f), 'utf-8');
      // 지시어는 파일 첫 문장에서만 효력이 있다(주석 속 언급은 무관).
      expect(src).not.toMatch(/^\s*['"]use client['"]/m);
      expect(src).not.toMatch(/saju-intake\/onboarding-storage/);
    }
  });
});
