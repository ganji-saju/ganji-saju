import { NextRequest, NextResponse } from 'next/server';
import type { CompatibilityRelationshipType } from '@/domain/compatibility-personality';
import { isPersonalityCompatibilityQuestionKey } from '@/features/compatibility/personality-compatibility-input-storage';
import {
  PERSONALITY_COMPATIBILITY_MINI_INCLUDED_SUBSCRIPTION_PLANS,
  PERSONALITY_COMPATIBILITY_MINI_MEMBERSHIP_POLICY,
  PERSONALITY_COMPATIBILITY_MINI_PRODUCT_CODE,
  PERSONALITY_COMPATIBILITY_MINI_PRICE,
} from '@/lib/payments/personality-compatibility';
import { getTasteProductEntitlement } from '@/lib/product-entitlements';
import {
  createClient,
  hasSupabaseServerEnv,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';
import { getManagedSubscription } from '@/lib/subscription';
import { readString } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

const RELATIONSHIP_TYPES: readonly CompatibilityRelationshipType[] = [
  'dating',
  'marriage',
  'friendship',
  'family',
  'business',
];

type ReportProductCode = 'free' | typeof PERSONALITY_COMPATIBILITY_MINI_PRODUCT_CODE;

interface PersonalityCompatibilityReportRow {
  id: string;
  user_id: string;
  scope_key: string | null;
  relationship_type: CompatibilityRelationshipType;
  question_type: string;
  score_json: Record<string, unknown>;
  saju_facts_json: Record<string, unknown>;
  personality_facts_json: Record<string, unknown>;
  report_json: Record<string, unknown>;
  product_code: ReportProductCode;
  paid_amount: number | null;
  created_at: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRelationshipType(value: unknown): value is CompatibilityRelationshipType {
  return (
    typeof value === 'string' &&
    RELATIONSHIP_TYPES.includes(value as CompatibilityRelationshipType)
  );
}

function readJsonObject(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return isRecord(value) ? value : null;
}

function normalizeProductCode(value: unknown): ReportProductCode | null {
  if (value === 'free') return 'free';
  if (value === PERSONALITY_COMPATIBILITY_MINI_PRODUCT_CODE) {
    return PERSONALITY_COMPATIBILITY_MINI_PRODUCT_CODE;
  }
  return null;
}

function buildRevisitPath(id: string) {
  return `/compatibility/personality/result?reportId=${encodeURIComponent(id)}`;
}

function hasIncludedMembership(plan: string | null | undefined) {
  return PERSONALITY_COMPATIBILITY_MINI_INCLUDED_SUBSCRIPTION_PLANS.some(
    (includedPlan) => includedPlan === plan
  );
}

async function hasPaidReportAccess(userId: string, scopeKey: string | null) {
  if (!hasSupabaseServiceEnv) return false;

  const [entitlement, subscription] = await Promise.all([
    getTasteProductEntitlement(
      userId,
      PERSONALITY_COMPATIBILITY_MINI_PRODUCT_CODE,
      scopeKey
    ).catch(() => null),
    getManagedSubscription(userId).catch(() => null),
  ]);

  const membershipIncluded =
    subscription?.status === 'active' && hasIncludedMembership(subscription.plan);

  return Boolean(entitlement || membershipIncluded);
}

function sanitizeReportJson(
  reportJson: Record<string, unknown>,
  productCode: ReportProductCode,
  reportId?: string
) {
  const isPaid = productCode === PERSONALITY_COMPATIBILITY_MINI_PRODUCT_CODE;
  const shareCard = isRecord(reportJson.shareCard) ? reportJson.shareCard : {};

  return {
    ...reportJson,
    paidSections: isPaid ? reportJson.paidSections : [],
    resultType: isPaid ? 'paid' : 'free',
    shareCard: {
      ...shareCard,
      revisitPath: reportId ? buildRevisitPath(reportId) : shareCard.revisitPath,
    },
  };
}

function mapReport(row: PersonalityCompatibilityReportRow, hasPaidAccess: boolean) {
  const effectiveProductCode =
    row.product_code === PERSONALITY_COMPATIBILITY_MINI_PRODUCT_CODE && hasPaidAccess
      ? PERSONALITY_COMPATIBILITY_MINI_PRODUCT_CODE
      : 'free';

  return {
    id: row.id,
    scopeKey: row.scope_key,
    relationshipType: row.relationship_type,
    questionKey: row.question_type,
    scoreJson: row.score_json,
    sajuFactsJson: row.saju_facts_json,
    personalityFactsJson: row.personality_facts_json,
    reportJson: sanitizeReportJson(row.report_json, effectiveProductCode, row.id),
    productCode: effectiveProductCode,
    paidAmount:
      effectiveProductCode === PERSONALITY_COMPATIBILITY_MINI_PRODUCT_CODE
        ? row.paid_amount
        : null,
    createdAt: row.created_at,
  };
}

export async function GET(request: NextRequest) {
  if (!hasSupabaseServerEnv) {
    return NextResponse.json({ error: '저장소 설정이 필요합니다.' }, { status: 503 });
  }

  const id = request.nextUrl.searchParams.get('id')?.trim();
  if (!id) {
    return NextResponse.json({ error: '조회할 결과가 필요합니다.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('compatibility_personality_reports')
    .select(
      'id, user_id, scope_key, relationship_type, question_type, score_json, saju_facts_json, personality_facts_json, report_json, product_code, paid_amount, created_at'
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: '저장된 결과를 찾지 못했습니다.' }, { status: 404 });
  }

  const row = data as PersonalityCompatibilityReportRow;
  const hasPaidAccess =
    row.product_code === PERSONALITY_COMPATIBILITY_MINI_PRODUCT_CODE
      ? await hasPaidReportAccess(user.id, row.scope_key)
      : false;

  return NextResponse.json({ report: mapReport(row, hasPaidAccess) });
}

export async function POST(request: NextRequest) {
  if (!hasSupabaseServerEnv) {
    return NextResponse.json({ error: '저장소 설정이 필요합니다.' }, { status: 503 });
  }

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) {
    return NextResponse.json({ error: '저장할 결과 정보가 올바르지 않습니다.' }, { status: 400 });
  }

  const scopeKey = readString(payload, 'scopeKey') || null;
  const relationshipType = payload.relationshipType;
  const questionKey = readString(payload, 'questionKey');
  const scoreJson = readJsonObject(payload, 'scoreJson');
  const sajuFactsJson = readJsonObject(payload, 'sajuFactsJson') ?? {};
  const personalityFactsJson = readJsonObject(payload, 'personalityFactsJson') ?? {};
  const reportJson = readJsonObject(payload, 'reportJson');
  const productCode = normalizeProductCode(payload.productCode);

  if (
    !scopeKey ||
    !isRelationshipType(relationshipType) ||
    !isPersonalityCompatibilityQuestionKey(questionKey) ||
    !scoreJson ||
    !reportJson ||
    !productCode
  ) {
    return NextResponse.json({ error: '저장할 결과 정보가 올바르지 않습니다.' }, { status: 400 });
  }

  const paidAmount =
    productCode === PERSONALITY_COMPATIBILITY_MINI_PRODUCT_CODE
      ? PERSONALITY_COMPATIBILITY_MINI_PRICE
      : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const isPaidProduct = productCode === PERSONALITY_COMPATIBILITY_MINI_PRODUCT_CODE;
  const hasPaidAccess = isPaidProduct ? await hasPaidReportAccess(user.id, scopeKey) : false;

  if (isPaidProduct && !hasPaidAccess) {
    return NextResponse.json(
      {
        error: '깊이보기 권한이 필요합니다.',
        membershipPolicy: PERSONALITY_COMPATIBILITY_MINI_MEMBERSHIP_POLICY,
      },
      { status: 403 }
    );
  }

  const { data, error } = await supabase
    .from('compatibility_personality_reports')
    .upsert(
      {
        user_id: user.id,
        scope_key: scopeKey,
        relationship_type: relationshipType,
        question_type: questionKey,
        score_json: scoreJson,
        saju_facts_json: sajuFactsJson,
        personality_facts_json: personalityFactsJson,
        report_json: sanitizeReportJson(reportJson, productCode),
        product_code: productCode,
        paid_amount: paidAmount,
      },
      { onConflict: 'user_id,scope_key' }
    )
    .select(
      'id, user_id, scope_key, relationship_type, question_type, score_json, saju_facts_json, personality_facts_json, report_json, product_code, paid_amount, created_at'
    )
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? '성향궁합 결과를 저장하지 못했습니다.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    report: mapReport(data as PersonalityCompatibilityReportRow, hasPaidAccess),
  });
}
