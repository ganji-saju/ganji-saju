import { NextRequest, NextResponse } from 'next/server';
import {
  SAJU_PERSONALITY_LIFE_AREAS,
  type SajuPersonalityLifeArea,
} from '@/domain/saju-personality';
import type { SajuPersonalityReportSnapshot } from '@/features/saju-personality/saju-personality-result-builder';
import { readString } from '@/lib/api-utils';
import {
  SAJU_PERSONALITY_MINI_INCLUDED_SUBSCRIPTION_PLANS,
  SAJU_PERSONALITY_MINI_MEMBERSHIP_POLICY,
  SAJU_PERSONALITY_MINI_PRICE,
  SAJU_PERSONALITY_MINI_PRODUCT_CODE,
} from '@/lib/payments/saju-personality';
import { getTasteProductEntitlement } from '@/lib/product-entitlements';
import {
  createClient,
  hasSupabaseServerEnv,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';
import { getManagedSubscription } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

type ReportProductCode = 'free' | typeof SAJU_PERSONALITY_MINI_PRODUCT_CODE;
type ReportType = 'free' | 'paid';

interface SajuPersonalityReportRow {
  id: string;
  user_id: string;
  profile_id: string | null;
  saju_chart_id: string | null;
  personality_profile_id: string | null;
  scope_key: string;
  report_type: ReportType;
  life_area: SajuPersonalityLifeArea;
  score_json: Record<string, unknown>;
  saju_facts_json: Record<string, unknown>;
  personality_facts_json: Record<string, unknown>;
  fusion_facts_json: Record<string, unknown>;
  report_json: Record<string, unknown>;
  product_code: ReportProductCode;
  paid_amount: number | null;
  created_at: string;
  updated_at: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readJsonObject(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return isRecord(value) ? value : null;
}

function isLifeArea(value: unknown): value is SajuPersonalityLifeArea {
  return (
    typeof value === 'string' &&
    SAJU_PERSONALITY_LIFE_AREAS.includes(value as SajuPersonalityLifeArea)
  );
}

function normalizeProductCode(value: unknown): ReportProductCode | null {
  if (value === 'free') return 'free';
  if (value === SAJU_PERSONALITY_MINI_PRODUCT_CODE) return SAJU_PERSONALITY_MINI_PRODUCT_CODE;
  return null;
}

function buildRevisitPath(id: string) {
  return `/saju/personality/result?reportId=${encodeURIComponent(id)}`;
}

function hasIncludedMembership(plan: string | null | undefined) {
  return SAJU_PERSONALITY_MINI_INCLUDED_SUBSCRIPTION_PLANS.some(
    (includedPlan) => includedPlan === plan
  );
}

async function hasPaidReportAccess(userId: string, scopeKey: string | null) {
  if (!hasSupabaseServiceEnv) return false;

  const [entitlement, subscription] = await Promise.all([
    getTasteProductEntitlement(userId, SAJU_PERSONALITY_MINI_PRODUCT_CODE, scopeKey).catch(
      () => null
    ),
    getManagedSubscription(userId).catch(() => null),
  ]);
  const membershipIncluded =
    subscription?.status === 'active' && hasIncludedMembership(subscription.plan);

  return Boolean(entitlement || membershipIncluded);
}

function sanitizeStringArray(value: unknown, fallback: string[] = []) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').slice(0, 6)
    : fallback;
}

function sanitizeShareCard(value: unknown, reportId?: string) {
  const shareCard = isRecord(value) ? value : {};
  const axisHighlights = Array.isArray(shareCard.axisHighlights)
    ? shareCard.axisHighlights
        .filter(isRecord)
        .map((item) => ({
          label: typeof item.label === 'string' ? item.label : '핵심 축',
          summary: typeof item.summary === 'string' ? item.summary : '오늘 살피기 좋은 흐름',
        }))
        .slice(0, 3)
    : [];

  return {
    keywords: sanitizeStringArray(shareCard.keywords, ['자기이해', '선택 습관', '오늘의 조절점']).slice(0, 3),
    axisHighlights,
    todayMessage:
      typeof shareCard.todayMessage === 'string'
        ? shareCard.todayMessage
        : '오늘은 기준을 하나만 남기고 가볍게 움직이는 편이 도움이 됩니다.',
    brandText: '달빛인생',
    revisitPath:
      reportId
        ? buildRevisitPath(reportId)
        : typeof shareCard.revisitPath === 'string'
          ? shareCard.revisitPath
          : '/saju/personality',
  };
}

function sanitizeReportJson(
  reportJson: Record<string, unknown>,
  productCode: ReportProductCode,
  reportId?: string,
  options: { preservePaidSections?: boolean } = {}
): SajuPersonalityReportSnapshot {
  const isPaid = productCode === SAJU_PERSONALITY_MINI_PRODUCT_CODE;
  const shouldKeepPaidSections = isPaid || options.preservePaidSections === true;
  const {
    facts: _facts,
    birthInput: _birthInput,
    birthSummary: _birthSummary,
    displayName: _displayName,
    personalityAnswers: _personalityAnswers,
    ...safeReport
  } = reportJson;

  return {
    ...safeReport,
    version: 1,
    resultType: isPaid ? 'paid' : 'free',
    scopeKey: typeof reportJson.scopeKey === 'string' ? reportJson.scopeKey : '',
    lifeArea: isLifeArea(reportJson.lifeArea) ? reportJson.lifeArea : 'basic',
    lifeAreaLabel:
      typeof reportJson.lifeAreaLabel === 'string' ? reportJson.lifeAreaLabel : '기본 성향',
    headline:
      typeof reportJson.headline === 'string'
        ? reportJson.headline
        : '사주와 성향으로 나의 결을 살펴봤습니다.',
    keywords: sanitizeStringArray(reportJson.keywords, ['타고난 결', '선택 습관', '오늘의 조절점']),
    scores: isRecord(reportJson.scores) ? reportJson.scores : {},
    axisSummaries: Array.isArray(reportJson.axisSummaries) ? reportJson.axisSummaries : [],
    sajuSummary: typeof reportJson.sajuSummary === 'string' ? reportJson.sajuSummary : '',
    personalitySummary:
      typeof reportJson.personalitySummary === 'string' ? reportJson.personalitySummary : '',
    lockedSections: Array.isArray(reportJson.lockedSections) ? reportJson.lockedSections : [],
    paidSections:
      shouldKeepPaidSections && Array.isArray(reportJson.paidSections)
        ? reportJson.paidSections
        : [],
    safetyNote: typeof reportJson.safetyNote === 'string' ? reportJson.safetyNote : '',
    shareCard: sanitizeShareCard(reportJson.shareCard, reportId),
    savedAt: typeof reportJson.savedAt === 'string' ? reportJson.savedAt : new Date().toISOString(),
  } as unknown as SajuPersonalityReportSnapshot;
}

function mapReport(row: SajuPersonalityReportRow, hasPaidAccess: boolean) {
  const effectiveProductCode = hasPaidAccess ? SAJU_PERSONALITY_MINI_PRODUCT_CODE : 'free';
  const effectiveReportType: ReportType =
    effectiveProductCode === SAJU_PERSONALITY_MINI_PRODUCT_CODE ? 'paid' : 'free';

  return {
    id: row.id,
    scopeKey: row.scope_key,
    reportType: effectiveReportType,
    lifeArea: row.life_area,
    scoreJson: row.score_json,
    sajuFactsJson: row.saju_facts_json,
    personalityFactsJson: row.personality_facts_json,
    fusionFactsJson: row.fusion_facts_json,
    reportJson: sanitizeReportJson(row.report_json, effectiveProductCode, row.id),
    productCode: effectiveProductCode,
    paidAmount:
      effectiveProductCode === SAJU_PERSONALITY_MINI_PRODUCT_CODE
        ? (row.paid_amount ?? SAJU_PERSONALITY_MINI_PRICE)
        : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(request: NextRequest) {
  if (!hasSupabaseServerEnv) {
    return NextResponse.json({ error: '저장소 설정이 필요합니다.' }, { status: 503 });
  }

  const id = request.nextUrl.searchParams.get('id')?.trim();
  const scope = request.nextUrl.searchParams.get('scope')?.trim();

  if (!id && !scope) {
    return NextResponse.json({ error: '조회할 결과가 필요합니다.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  let query = supabase
    .from('saju_personality_reports')
    .select(
      'id, user_id, profile_id, saju_chart_id, personality_profile_id, scope_key, report_type, life_area, score_json, saju_facts_json, personality_facts_json, fusion_facts_json, report_json, product_code, paid_amount, created_at, updated_at'
    )
    .eq('user_id', user.id);

  query = id ? query.eq('id', id) : query.eq('scope_key', scope);

  const { data, error } = await query
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: '저장된 결과를 찾지 못했습니다.' }, { status: 404 });
  }

  const row = data as SajuPersonalityReportRow;
  const hasPaidAccess = await hasPaidReportAccess(user.id, row.scope_key);

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

  const scopeKey = readString(payload, 'scopeKey');
  const lifeArea = payload.lifeArea;
  const scoreJson = readJsonObject(payload, 'scoreJson');
  const sajuFactsJson = readJsonObject(payload, 'sajuFactsJson') ?? {};
  const personalityFactsJson = readJsonObject(payload, 'personalityFactsJson') ?? {};
  const fusionFactsJson = readJsonObject(payload, 'fusionFactsJson') ?? {};
  const reportJson = readJsonObject(payload, 'reportJson');
  const productCode = normalizeProductCode(payload.productCode);

  if (!scopeKey || !isLifeArea(lifeArea) || !scoreJson || !reportJson || !productCode) {
    return NextResponse.json({ error: '저장할 결과 정보가 올바르지 않습니다.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const isPaidProduct = productCode === SAJU_PERSONALITY_MINI_PRODUCT_CODE;
  const hasPaidAccess = isPaidProduct ? await hasPaidReportAccess(user.id, scopeKey) : false;

  if (isPaidProduct && !hasPaidAccess) {
    return NextResponse.json(
      {
        error: '깊이보기 권한이 필요합니다.',
        membershipPolicy: SAJU_PERSONALITY_MINI_MEMBERSHIP_POLICY,
      },
      { status: 403 }
    );
  }

  if (!isPaidProduct) {
    const { data: existingPaid } = await supabase
      .from('saju_personality_reports')
      .select(
        'id, user_id, profile_id, saju_chart_id, personality_profile_id, scope_key, report_type, life_area, score_json, saju_facts_json, personality_facts_json, fusion_facts_json, report_json, product_code, paid_amount, created_at, updated_at'
      )
      .eq('user_id', user.id)
      .eq('scope_key', scopeKey)
      .eq('product_code', SAJU_PERSONALITY_MINI_PRODUCT_CODE)
      .maybeSingle();

    if (existingPaid) {
      const canReadPaid = await hasPaidReportAccess(user.id, scopeKey);
      if (canReadPaid) {
        return NextResponse.json({
          report: mapReport(existingPaid as SajuPersonalityReportRow, true),
        });
      }
    }
  }

  const reportType: ReportType = isPaidProduct ? 'paid' : 'free';
  const paidAmount = isPaidProduct ? SAJU_PERSONALITY_MINI_PRICE : null;

  const { data, error } = await supabase
    .from('saju_personality_reports')
    .upsert(
      {
        user_id: user.id,
        scope_key: scopeKey,
        report_type: reportType,
        life_area: lifeArea,
        score_json: scoreJson,
        saju_facts_json: sajuFactsJson,
        personality_facts_json: personalityFactsJson,
        fusion_facts_json: fusionFactsJson,
        report_json: sanitizeReportJson(reportJson, productCode, undefined, {
          preservePaidSections: true,
        }),
        product_code: productCode,
        paid_amount: paidAmount,
      },
      { onConflict: 'user_id,scope_key' }
    )
    .select(
      'id, user_id, profile_id, saju_chart_id, personality_profile_id, scope_key, report_type, life_area, score_json, saju_facts_json, personality_facts_json, fusion_facts_json, report_json, product_code, paid_amount, created_at, updated_at'
    )
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? '성향사주 결과를 저장하지 못했습니다.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    report: mapReport(data as SajuPersonalityReportRow, hasPaidAccess),
  });
}
