// 2026-05-20 Phase 8-A — SEO content page 의 metadata 통일 helper.
//   3 area (꿈해몽 / 띠운세 / 별자리) detail page 의 generateMetadata 가
//   동일 패턴 (title / description / canonical / openGraph / twitter) 으로
//   build 되도록 한 곳에서 관리.

import type { Metadata } from 'next';
import { getSiteUrl, SITE_NAME } from '@/lib/site';

export interface ContentPageMetadataInput {
  /** 페이지 메인 title. SITE_NAME 은 layout.tsx 의 template (`%s | 간지사주`) 에서 자동 append. */
  title: string;
  /** 페이지 description. SERP / OG 공통. 80-160 chars 권장. */
  description: string;
  /** site-relative canonical path (e.g. '/star-sign/aries'). */
  path: string;
  /** OG type. content page 는 'article' 권장. */
  ogType?: 'article' | 'website';
  /** OG image absolute or site-relative URL. 미지정 시 사이트 default. */
  ogImagePath?: string;
}

export function buildContentPageMetadata(input: ContentPageMetadataInput): Metadata {
  const url = `${getSiteUrl()}${input.path}`;
  const ogType = input.ogType ?? 'article';
  const ogImageUrl = input.ogImagePath
    ? input.ogImagePath.startsWith('http')
      ? input.ogImagePath
      : `${getSiteUrl()}${input.ogImagePath}`
    : undefined;

  return {
    title: input.title,
    description: input.description,
    alternates: {
      canonical: input.path,
    },
    openGraph: {
      type: ogType,
      locale: 'ko_KR',
      siteName: SITE_NAME,
      title: input.title,
      description: input.description,
      url,
      ...(ogImageUrl ? { images: [{ url: ogImageUrl }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: input.title,
      description: input.description,
      ...(ogImageUrl ? { images: [ogImageUrl] } : {}),
    },
  };
}
