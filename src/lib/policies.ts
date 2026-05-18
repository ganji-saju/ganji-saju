/**
 * 정책 버저닝 + 사용자 동의 이력 유틸 — Phase 3-B (2026-05-18).
 *
 * - DB source: policy_versions, user_policy_consents (migration 031)
 * - 9 정책 종류: terms / privacy / refund / digital-content / subscription /
 *               coin / appointment / ai-disclaimer / commerce-disclosure
 * - 사용처: src/app/(terms|privacy|...)/page.tsx 의 SSR fetch
 *           src/app/admin/policies/* 의 운영자 입력
 *           src/app/api/admin/policies/* 의 CRUD API
 *           결제 동의 (Phase 3-C)
 */

import { createHash } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/server';
import {
  POLICY_KINDS,
  POLICY_LABELS,
  POLICY_URLS,
  type ConsentMethod,
  type PolicyContentFormat,
  type PolicyKind,
  type PolicyVersion,
} from '@/shared/policies/types';

// Re-export client-safe types + 상수 (기존 caller 호환).
export {
  POLICY_KINDS,
  POLICY_LABELS,
  POLICY_URLS,
  type ConsentMethod,
  type PolicyContentFormat,
  type PolicyKind,
  type PolicyVersion,
};

/** 본문 SHA-256 hash. content 무결성 검증 + 자동 변경 감지용. */
export function computeContentHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * IP 원문은 저장하지 않음. SHA-256 hash 만 → user_policy_consents.ip_hash.
 * 동일 IP 의 동일 동의를 식별 가능하지만 원문 IP 는 복구 불가.
 */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash('sha256').update(ip.trim(), 'utf8').digest('hex');
}

interface PolicyRow {
  id: string;
  kind: string;
  version: string;
  effective_date: string;
  content: string;
  content_format: string;
  content_hash: string;
  requires_reconsent: boolean;
  changelog: string | null;
  created_at: string;
  created_by: string | null;
}

function rowToPolicy(row: PolicyRow): PolicyVersion {
  return {
    id: row.id,
    kind: row.kind as PolicyKind,
    version: row.version,
    effectiveDate: row.effective_date,
    content: row.content,
    contentFormat: row.content_format as PolicyContentFormat,
    contentHash: row.content_hash,
    requiresReconsent: row.requires_reconsent,
    changelog: row.changelog,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

/**
 * 주어진 종류의 현재 활성 정책 버전 (시행일이 오늘 이전인 최신).
 * 운영자가 아직 본문 입력 안 했으면 null → 페이지는 noindex + CS 안내 fallback.
 */
export async function getCurrentPolicyVersion(
  kind: PolicyKind
): Promise<PolicyVersion | null> {
  // CI 빌드 / preview 빌드에서 Supabase env 없을 때 graceful null (PolicyNotReady 노출).
  // production runtime 에는 env 가 있어 정상 fetch.
  if (!hasSupabaseServiceEnv()) return null;
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from('policy_versions')
    .select('*')
    .eq('kind', kind)
    .lte('effective_date', today)
    .order('effective_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return rowToPolicy(data as PolicyRow);
}

function hasSupabaseServiceEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/** 종류별 모든 버전 이력 (admin 페이지 + /policies/[kind]/history 용). */
export async function listPolicyVersions(kind: PolicyKind): Promise<PolicyVersion[]> {
  if (!hasSupabaseServiceEnv()) return [];
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from('policy_versions')
    .select('*')
    .eq('kind', kind)
    .order('effective_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return (data as PolicyRow[]).map(rowToPolicy);
}

/** 모든 종류의 활성 버전 (푸터 / 정책 hub 용). */
export async function getAllActivePolicyVersions(): Promise<
  Partial<Record<PolicyKind, PolicyVersion>>
> {
  if (!hasSupabaseServiceEnv()) return {};
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from('policy_versions')
    .select('*')
    .lte('effective_date', today)
    .order('effective_date', { ascending: false });
  if (error || !data) return {};

  const result: Partial<Record<PolicyKind, PolicyVersion>> = {};
  for (const row of data as PolicyRow[]) {
    const kind = row.kind as PolicyKind;
    if (!result[kind]) result[kind] = rowToPolicy(row);
  }
  return result;
}

/** admin 운영자가 새 버전 생성 (admin API 에서만 호출). */
export async function createPolicyVersion(input: {
  kind: PolicyKind;
  version: string;
  effectiveDate: string;
  content: string;
  contentFormat?: PolicyContentFormat;
  requiresReconsent?: boolean;
  changelog?: string | null;
  createdBy?: string | null;
}): Promise<PolicyVersion> {
  const contentHash = computeContentHash(input.content);
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from('policy_versions')
    .insert({
      kind: input.kind,
      version: input.version,
      effective_date: input.effectiveDate,
      content: input.content,
      content_format: input.contentFormat ?? 'markdown',
      content_hash: contentHash,
      requires_reconsent: input.requiresReconsent ?? false,
      changelog: input.changelog ?? null,
      created_by: input.createdBy ?? null,
    })
    .select('*')
    .single();
  if (error || !data) {
    throw new Error(`createPolicyVersion failed: ${error?.message ?? 'unknown'}`);
  }
  return rowToPolicy(data as PolicyRow);
}

/** 사용자 동의 기록. 회원가입 / 결제 / 재동의 모달 등에서 호출. */
export async function recordUserConsent(input: {
  userId: string;
  policyVersionId: string;
  consentMethod: ConsentMethod;
  productId?: string | null;
  orderId?: string | null;
  userAgent?: string | null;
  ip?: string | null;
}): Promise<void> {
  const supabase = await createServiceClient();
  const { error } = await supabase.from('user_policy_consents').insert({
    user_id: input.userId,
    policy_version_id: input.policyVersionId,
    consent_method: input.consentMethod,
    product_id: input.productId ?? null,
    order_id: input.orderId ?? null,
    user_agent: input.userAgent ?? null,
    ip_hash: hashIp(input.ip),
  });
  if (error && !error.message.includes('duplicate')) {
    // duplicate (UNIQUE 충돌) = 이미 동의함 → 정상. 그 외만 throw.
    throw new Error(`recordUserConsent failed: ${error.message}`);
  }
}
