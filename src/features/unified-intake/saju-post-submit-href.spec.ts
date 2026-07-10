import { describe, expect, it } from 'vitest';
import { buildSajuPostSubmitHref } from './saju-post-submit-href';

// 회귀 커버: 구 위저드 buildPostSubmitHref(saju-intake-page.tsx, git 71edd70)의 유료 퍼널 분기.
// /saju/new?product=/?plan= 딥링크가 /membership/checkout 으로 라우팅되어야 한다.
describe('buildSajuPostSubmitHref', () => {
  it('plan=lifetime → 평생권 체크아웃', () => {
    const href = buildSajuPostSubmitHref('ID', {
      focusTopic: 'today',
      product: null,
      plan: 'lifetime',
      from: 'saju-new',
    });
    expect(href).toBe('/membership/checkout?plan=lifetime&slug=ID&from=saju-new');
  });

  it('product=money-pattern → add-on 체크아웃(scope 없음)', () => {
    const href = buildSajuPostSubmitHref('ID', {
      focusTopic: 'wealth',
      product: 'money-pattern',
      plan: null,
      from: 'saju-new',
    });
    expect(href).toBe('/membership/checkout?product=money-pattern&slug=ID&from=saju-new');
  });

  it('product=monthly-calendar → scope 파라미터 포함', () => {
    const href = buildSajuPostSubmitHref('ID', {
      focusTopic: 'today',
      product: 'monthly-calendar',
      plan: null,
      from: 'saju-new',
    });
    const url = new URL(href, 'https://example.com');
    expect(url.pathname).toBe('/membership/checkout');
    expect(url.searchParams.get('product')).toBe('monthly-calendar');
    expect(url.searchParams.get('slug')).toBe('ID');
    expect(url.searchParams.get('from')).toBe('saju-new');
    // 정확한 날짜는 단언하지 않음 — scope 파라미터 존재만 확인.
    expect(url.searchParams.get('scope')).toBeTruthy();
  });

  it('product=year-core → scope=연도 포함', () => {
    const href = buildSajuPostSubmitHref('ID', {
      focusTopic: 'today',
      product: 'year-core',
      plan: null,
      from: 'saju-new',
    });
    const url = new URL(href, 'https://example.com');
    expect(url.searchParams.get('product')).toBe('year-core');
    expect(url.searchParams.get('scope')).toBeTruthy();
  });

  it('product=null, plan=null, from=saju-new → 일반 사주 결과 href', () => {
    const href = buildSajuPostSubmitHref('ID', {
      focusTopic: 'love',
      product: null,
      plan: null,
      from: 'saju-new',
    });
    expect(href).toBe('/saju/ID?from=saju-new&topic=love');
  });

  it('from=start, 전부 null → /start 기본 결과 href', () => {
    const href = buildSajuPostSubmitHref('ID', {
      focusTopic: 'today',
      product: null,
      plan: null,
      from: 'start',
    });
    expect(href).toBe('/saju/ID?from=start&topic=today');
  });
});
