// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/payments/price-display', () => ({
  getPriceDisplayMap: vi.fn(async () => ({
    report_lifetime: { value: 29900, label: '29,900원', compareValue: 60000, compareLabel: '60,000원' },
    report_new_year: { value: 19900, label: '19,900원', compareValue: 40000, compareLabel: '40,000원' },
  })),
}));
vi.mock('@/components/site-footer', () => ({ default: () => <footer data-testid="footer" /> }));

import Page from './page';

describe('/saju-report', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('PPT 순서대로 칸이 있고 두 상품의 정가·판매가가 보인다', async () => {
    const html = renderToStaticMarkup(await Page());
    const order = ['사람들은 왜 지금도 사주를 볼까요', '막연한 불안', '사주는 생년월일시', '내 인생은 언제쯤', '그래서 준비했습니다', '가격이 부담되신다면', '자격증 5개 보유', '이런 분께', 'id="order"', '상담 및 이용 안내'];
    const positions = order.map((t) => html.indexOf(t));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(html).toContain('29,900원');
    expect(html).toContain('60,000원');
    expect(html).toContain('19,900원');
    expect(html).toContain('40,000원');
    expect(html).toContain('href="#order-lifetime"');
    expect(html).toContain('href="#order-new-year"');
  });

  it('사진 아래 연출 사진 안내, 한자 없음, AI 안내 링크', async () => {
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain('이미지는 연출 사진입니다.');
    expect(html).not.toMatch(/[一-鿿]/);
    expect(html).toContain('href="/ai-disclaimer"');
  });

  it('후기가 없으면 후기 칸을 그리지 않는다', async () => {
    const html = renderToStaticMarkup(await Page());
    expect(html).not.toContain('이용하신 분들의 후기');
  });

  it('무통장 계좌 env 가 없으면 무통장 선택지가 없다', async () => {
    vi.stubEnv('REPORT_BANK_NAME', '');
    expect(renderToStaticMarkup(await Page())).not.toContain('무통장 입금으로');
    expect(renderToStaticMarkup(await Page())).not.toContain('id="report-order-pay-bank"');
    vi.stubEnv('REPORT_BANK_NAME', '국민은행');
    vi.stubEnv('REPORT_BANK_ACCOUNT', '1');
    vi.stubEnv('REPORT_BANK_HOLDER', '푸꼬');
    expect(renderToStaticMarkup(await Page())).toContain('id="report-order-pay-bank"');
  });
});
