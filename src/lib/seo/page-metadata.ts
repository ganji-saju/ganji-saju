// 2026-05-20 Phase 8-A — SEO content page 의 metadata 통일 helper.
//   3 area (꿈해몽 / 띠운세 / 별자리) detail page 의 generateMetadata 가
//   동일 패턴 (title / description / canonical / openGraph / twitter) 으로
//   build 되도록 한 곳에서 관리.

import type { Metadata } from 'next';
import { getSiteUrl, SITE_NAME, DEFAULT_OG_IMAGE } from '@/lib/site';

export interface ContentPageMetadataInput {
  /** 페이지 메인 title. SITE_NAME 은 layout.tsx 의 template (`%s | 간지사주`) 에서 자동 append. */
  title: string;
  /** 페이지 description. SERP / OG 공통. 80-160 chars 권장. */
  description: string;
  /** site-relative canonical path (e.g. '/star-sign/aries'). */
  path: string;
  /** OG type. content page 는 'article' 권장. */
  ogType?: 'article' | 'website';
  /** OG image absolute or site-relative URL. 미지정 시 사이트 default(브랜드 og-image). */
  ogImagePath?: string;
}

// 2026-06-30 — og:image 사이트 기본값(브랜드 로고). Next 는 child 가 openGraph 를
//   정의하면 parent(layout)의 openGraph.images 를 상속하지 않으므로, 콘텐츠 페이지도
//   명시적으로 기본 og-image 를 싣는다(미지정 시 폴백).
// 2026-07-03 — site.ts DEFAULT_OG_IMAGE 로 단일화(두 기본값이 다시 어긋나지 않게).
const DEFAULT_OG_IMAGE_PATH = DEFAULT_OG_IMAGE;

export function buildContentPageMetadata(input: ContentPageMetadataInput): Metadata {
  const url = `${getSiteUrl()}${input.path}`;
  const ogType = input.ogType ?? 'article';
  const ogImagePath = input.ogImagePath ?? DEFAULT_OG_IMAGE_PATH;
  const ogImageUrl = ogImagePath.startsWith('http')
    ? ogImagePath
    : `${getSiteUrl()}${ogImagePath}`;

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
