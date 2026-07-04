// 2026-07-05 SEO — RSS 2.0 피드 생성. 네이버 서치어드바이저 RSS 제출용 보조 채널
//   (sitemap 과 별개로 콘텐츠 URL/제목/설명을 제공해 수집 속도를 높인다).
//   콘텐츠 소스는 꿈해몽 사전(최대 코퍼스) + 띠운세 + 별자리. 순수 함수로 테스트 고정.
import { getSiteUrl, SITE_NAME } from '@/lib/site';

export interface RssItem {
  /** 절대 URL 아닌 site-relative path. */
  path: string;
  title: string;
  description: string;
}

/** XML 특수문자 이스케이프(<, >, &, ", '). RSS 텍스트 노드/속성 안전. */
export function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * RSS 2.0 XML 문서 문자열 생성(순수). lastBuildDate 는 호출부가 주입(테스트 결정론).
 * item.link/guid 는 site-relative path 를 절대 URL 로 변환.
 */
export function buildRssFeed(input: {
  items: ReadonlyArray<RssItem>;
  buildDate: string;
  title?: string;
  description?: string;
}): string {
  const siteUrl = getSiteUrl();
  const channelTitle = input.title ?? `${SITE_NAME} 콘텐츠`;
  const channelDesc =
    input.description ?? '꿈해몽·띠운세·별자리 등 간지사주의 무료 콘텐츠 업데이트.';

  const itemsXml = input.items
    .map((item) => {
      const link = `${siteUrl}${item.path}`;
      return [
        '    <item>',
        `      <title>${escapeXml(item.title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `      <description>${escapeXml(item.description)}</description>`,
        '    </item>',
      ].join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '  <channel>',
    `    <title>${escapeXml(channelTitle)}</title>`,
    `    <link>${escapeXml(siteUrl)}</link>`,
    `    <description>${escapeXml(channelDesc)}</description>`,
    '    <language>ko</language>',
    `    <lastBuildDate>${escapeXml(input.buildDate)}</lastBuildDate>`,
    itemsXml,
    '  </channel>',
    '</rss>',
  ].join('\n');
}
