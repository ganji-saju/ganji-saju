import assert from 'node:assert/strict';
import { buildRssFeed, escapeXml } from './rss-feed';

// 2026-07-05 SEO — RSS 2.0 피드 생성 순수 로직.

declare const test: (name: string, fn: () => void | Promise<void>) => void;

test('escapeXml: XML 특수문자 5종 이스케이프', () => {
  assert.equal(escapeXml('a & b < c > d " e \' f'), 'a &amp; b &lt; c &gt; d &quot; e &apos; f');
});

test('buildRssFeed: 유효한 RSS 2.0 골격 + 절대 URL link/guid', () => {
  const xml = buildRssFeed({
    items: [{ path: '/dream-interpretation/snake-dream', title: '뱀 꿈', description: '재물·경계' }],
    buildDate: 'Sat, 05 Jul 2026 00:00:00 GMT',
  });
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<rss version="2\.0">/);
  assert.match(xml, /<language>ko<\/language>/);
  assert.match(xml, /<lastBuildDate>Sat, 05 Jul 2026 00:00:00 GMT<\/lastBuildDate>/);
  // link/guid 는 절대 URL(getSiteUrl + path).
  assert.match(xml, /<link>https?:\/\/[^<]+\/dream-interpretation\/snake-dream<\/link>/);
  assert.match(xml, /<guid isPermaLink="true">https?:\/\/[^<]+\/dream-interpretation\/snake-dream<\/guid>/);
  assert.match(xml, /<title>뱀 꿈<\/title>/);
});

test('buildRssFeed: item title/description 의 특수문자 이스케이프', () => {
  const xml = buildRssFeed({
    items: [{ path: '/x', title: 'A & B', description: '<b>주의</b>' }],
    buildDate: 'now',
  });
  assert.match(xml, /<title>A &amp; B<\/title>/);
  assert.match(xml, /<description>&lt;b&gt;주의&lt;\/b&gt;<\/description>/);
  // 원본 미이스케이프 태그가 새지 않아야 함.
  assert.ok(!xml.includes('<b>주의</b>'));
});

test('buildRssFeed: 빈 items 도 유효한 채널 골격', () => {
  const xml = buildRssFeed({ items: [], buildDate: 'now' });
  assert.match(xml, /<channel>[\s\S]*<\/channel>/);
  assert.ok(!xml.includes('<item>'));
});
