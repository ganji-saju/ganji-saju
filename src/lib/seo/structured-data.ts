// 2026-05-20 Phase 8-A — SEO structured data (JSON-LD schema.org) helpers.
//   3 SEO content area (꿈해몽 / 띠운세 / 별자리) detail page 통일.
//   Article + FAQPage + BreadcrumbList schema. <script type="application/ld+json"> 로 inject.

import { getSiteUrl, SITE_NAME } from '@/lib/site';

/** schema.org Article — content page 의 메인 schema. SERP rich result 후보. */
export interface ArticleSchemaInput {
  /** 페이지 메인 title (h1 또는 metadata.title). */
  headline: string;
  /** 페이지 설명. metadata.description 과 동일 권장. */
  description: string;
  /** site-relative path (e.g. '/star-sign/aries'). canonical 과 일치 필요. */
  path: string;
  /** ISO 8601 datetime — 콘텐츠 최초 게시일. fallback = 사이트 출시일. */
  datePublished?: string;
  /** ISO 8601 datetime — 최근 수정일. fallback = datePublished. */
  dateModified?: string;
  /** 콘텐츠 author. fallback = SITE_NAME. */
  authorName?: string;
  /** OG image absolute URL. 미지정 시 schema 에서 image 생략. */
  imageUrl?: string;
  /** 콘텐츠 분류 (예: '별자리 운세', '꿈해몽', '띠 운세'). */
  articleSection?: string;
}

const DEFAULT_PUBLISHED = '2026-05-13T00:00:00+09:00';

export function buildArticleSchema(input: ArticleSchemaInput): Record<string, unknown> {
  const url = `${getSiteUrl()}${input.path}`;
  const datePublished = input.datePublished ?? DEFAULT_PUBLISHED;
  const dateModified = input.dateModified ?? datePublished;
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.headline,
    description: input.description,
    url,
    inLanguage: 'ko-KR',
    datePublished,
    dateModified,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: {
      '@type': 'Organization',
      name: input.authorName ?? SITE_NAME,
      url: getSiteUrl(),
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: getSiteUrl(),
    },
  };
  if (input.imageUrl) {
    schema.image = input.imageUrl;
  }
  if (input.articleSection) {
    schema.articleSection = input.articleSection;
  }
  return schema;
}

/** schema.org FAQPage — 꿈해몽 등 FAQ 영역의 SERP rich result. */
export interface FAQPageSchemaInput {
  items: ReadonlyArray<{ question: string; answer: string }>;
}

export function buildFAQPageSchema(input: FAQPageSchemaInput): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: input.items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

/** schema.org BreadcrumbList — 페이지 hierarchy (홈 → 영역 → 상세). */
export interface BreadcrumbItem {
  name: string;
  path: string;
}

export function buildBreadcrumbSchema(items: ReadonlyArray<BreadcrumbItem>): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${getSiteUrl()}${item.path}`,
    })),
  };
}

/** JSON.stringify wrapper — XSS-safe `<` 이스케이프 포함. JSON-LD <script> 안에서 사용. */
export function serializeStructuredData(schema: Record<string, unknown>): string {
  return JSON.stringify(schema).replace(/</g, '\\u003c');
}
