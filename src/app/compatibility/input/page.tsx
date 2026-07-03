// Redesign 2026-05-17 — server wrapper. UI 는 CompatibilityInputClient 안에 있고
// 이 page 는 entitlement check + relationship resolve + client component mount 만.
// audit-redesign-coverage 의 wrapper detection 이 잡지 못한 thin server wrapper.
import type { Metadata } from 'next';
import { COMPATIBILITY_RELATIONSHIPS, type CompatibilityRelationshipSlug } from '@/content/moonlight';
import { CompatibilityInputClient } from '@/features/compatibility/compatibility-input-client';
import { getTasteProductEntitlement } from '@/lib/product-entitlements';
import {
  createClient,
  hasSupabaseServerEnv,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';

interface Props {
  searchParams: Promise<{ relationship?: string; paid?: string }>;
}

function resolveRelationship(value: string | undefined): CompatibilityRelationshipSlug {
  return COMPATIBILITY_RELATIONSHIPS.some((item) => item.slug === value)
    ? (value as CompatibilityRelationshipSlug)
    : 'lover';
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '궁합 입력',
    description: '내 정보와 상대 정보를 직접 입력하거나 저장된 정보를 불러와 궁합을 준비하는 화면입니다.',
  };
}

export default async function CompatibilityInputPage({ searchParams }: Props) {
  const { relationship } = await searchParams;
  // 2026-07-03 보안 — URL ?paid= 쿼리 신뢰 제거(위조 가능 페이월 우회 + client 로
  //   paid= 재전파 체인 차단). 서버 entitlement 조회만 신뢰.
  let hasLoveQuestionPurchase = false;

  if (!hasLoveQuestionPurchase && hasSupabaseServerEnv && hasSupabaseServiceEnv) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      hasLoveQuestionPurchase = Boolean(
        await getTasteProductEntitlement(user.id, 'love-question')
      );
    }
  }

  return (
    <CompatibilityInputClient
      initialRelationship={resolveRelationship(relationship)}
      hasLoveQuestionPurchase={hasLoveQuestionPurchase}
    />
  );
}
