import { describe, expect, it } from 'vitest';
import * as content from './landing-content';

const allText = JSON.stringify(content);

describe('랜딩 문구', () => {
  it('한자를 쓰지 않는다', () => {
    expect(allText).not.toMatch(/[一-鿿]/);
  });
  it('나이스페이로 받을 수 없는 계좌이체를 안내하지 않는다', () => {
    expect(allText).not.toContain('계좌이체');
    expect(allText).toContain('무통장 입금');
  });
  it('쪽수는 실측 최소값 기준(종합 70쪽 이상)', () => {
    expect(allText).toContain('70쪽 이상');
    expect(allText).not.toContain('80장');
  });
  it('AI 가 만든 풀이를 전문가가 직접 풀이했다고 하지 않는다', () => {
    expect(allText).not.toContain('정성을 다해 풀이');
    expect(allText).toContain('직접 확인');
  });
  it('사진은 연출 사진이라고 밝힌다', () => {
    expect(content.PHOTO_NOTE).toBe('이미지는 연출 사진입니다.');
  });
  it('후기는 실제 후기를 받기 전까지 비어 있다', () => {
    expect(content.REVIEWS).toEqual([]);
  });
});
