import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import {
  generateYearlyInterpretation,
  type YearlyCacheKeyType,
  type YearlyGenerationStageResult,
} from '@/server/ai/saju-yearly-service';

const DEFAULT_YEARLY_AUDIT_SLUG = '1982-1-29-8-male';
const DEFAULT_YEARLY_AUDIT_YEAR = 2026;

export type YearlyAuditStatus = 'ready' | 'not-found' | 'error';

export interface YearlyVerificationCheck {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
}

interface YearlyCacheSchemaAudit {
  envReady: boolean;
  tableExists: boolean;
  readingSlugColumn: boolean;
  readingIdNullable: boolean | null;
  latestMigration: '011-missing' | '011-ready-012-missing' | '011-012-ready' | 'unknown';
  errorMessage: string | null;
}

async function inspectYearlyCacheSchema(): Promise<YearlyCacheSchemaAudit> {
  if (!hasSupabaseServiceEnv) {
    return {
      envReady: false,
      tableExists: false,
      readingSlugColumn: false,
      readingIdNullable: null,
      latestMigration: '011-missing',
      errorMessage: 'SUPABASE_SERVICE_ROLE_KEY가 없어 yearly cache 스키마를 조회할 수 없습니다.',
    };
  }

  try {
    const supabase = await createServiceClient();
    const { error: tableError } = await supabase
      .from('ai_yearly_interpretations')
      .select('id', { head: true, count: 'exact' })
      .limit(1);

    if (tableError) {
      const message = tableError.message ?? '';
      return {
        envReady: true,
        tableExists: false,
        readingSlugColumn: false,
        readingIdNullable: null,
        latestMigration:
          /relation .*ai_yearly_interpretations.* does not exist|Could not find the table/i.test(message)
            ? '011-missing'
            : 'unknown',
        errorMessage: message || null,
      };
    }

    const { error: slugColumnError } = await supabase
      .from('ai_yearly_interpretations')
      .select('reading_slug')
      .limit(1);

    if (slugColumnError) {
      return {
        envReady: true,
        tableExists: true,
        readingSlugColumn: false,
        readingIdNullable: null,
        latestMigration: /column .*reading_slug.* does not exist|Could not find the .*reading_slug/i.test(
          slugColumnError.message ?? ''
        )
          ? '011-ready-012-missing'
          : 'unknown',
        errorMessage: slugColumnError.message,
      };
    }

    return {
      envReady: true,
      tableExists: true,
      readingSlugColumn: true,
      readingIdNullable: null,
      latestMigration: '011-012-ready',
      errorMessage: null,
    };
  } catch (error) {
    return {
      envReady: true,
      tableExists: false,
      readingSlugColumn: false,
      readingIdNullable: null,
      latestMigration: 'unknown',
      errorMessage: error instanceof Error ? error.message : 'yearly cache schema 조회 실패',
    };
  }
}

function describeCacheKeyType(cacheKeyType: YearlyCacheKeyType) {
  switch (cacheKeyType) {
    case 'reading_id':
      return 'DB reading id로 캐시를 읽고 씁니다.';
    case 'reading_slug':
      return 'slug 방식 캐시 경로를 사용합니다. migration 012가 반영돼야 서버 캐시가 완전히 작동합니다.';
    default:
      return '현재 요청은 캐시 키를 만들 수 없는 상태입니다.';
  }
}

function summarizeStage(stage: YearlyGenerationStageResult) {
  return `${stage.key} · ${stage.source} · ${stage.durationMs}ms${
    stage.fallbackReason ? ` · ${stage.fallbackReason}` : ''
  }`;
}

function hasForbiddenGuarantee(text: string) {
  return /(무조건|반드시|100%)/.test(text);
}

function hasAiLikeTone(text: string) {
  return /(AI로서|분석해보면|결론적으로|표로 정리하면)/.test(text);
}

export async function getYearlyVerificationAudit({
  slug = DEFAULT_YEARLY_AUDIT_SLUG,
  targetYear = DEFAULT_YEARLY_AUDIT_YEAR,
  counselorId = 'female',
}: {
  slug?: string;
  targetYear?: number;
  counselorId?: 'female' | 'male';
} = {}) {
  const generatedAt = new Date().toISOString();
  const schema = await inspectYearlyCacheSchema();

  try {
    const result = await generateYearlyInterpretation({
      readingIdentifier: slug,
      targetYear,
      counselorId,
      regenerate: false,
    });

    if (!result) {
      return {
        generatedAt,
        status: 'not-found' as const,
        slug,
        targetYear,
        counselorId,
        schema,
        errors: ['연간 리포트를 만들 대상 사주 결과를 찾지 못했습니다.'],
      };
    }

    const checks: YearlyVerificationCheck[] = [
      {
        key: 'yearly-api-response',
        label: '연간 리포트 API 응답',
        ok: true,
        detail: `${result.targetYear}년 리포트 응답이 생성되었습니다.`,
      },
      {
        key: 'yearly-openai-source',
        label: 'OpenAI 생성 여부',
        ok: result.source === 'openai',
        detail:
          result.source === 'openai'
            ? '전체 연간 리포트가 OpenAI 단계 생성으로 완료되었습니다.'
            : `현재는 ${result.fallbackReason ?? 'fallback'} 사유로 일부 또는 전체가 fallback입니다.`,
      },
      {
        key: 'yearly-cache-schema',
        label: 'yearly cache 스키마',
        ok: schema.latestMigration === '011-012-ready',
        detail:
          schema.latestMigration === '011-012-ready'
            ? '011, 012 migration까지 반영되어 slug 캐시도 서버에서 사용할 수 있습니다.'
            : schema.latestMigration === '011-ready-012-missing'
              ? '011은 보이지만 012가 없어 slug 기반 서버 캐시는 아직 완전하지 않습니다.'
              : schema.latestMigration === '011-missing'
                ? '011 migration 테이블이 아직 보이지 않습니다.'
                : schema.errorMessage ?? 'yearly cache schema 상태를 확정하지 못했습니다.',
      },
      {
        key: 'yearly-cache-hit',
        label: '캐시 적중',
        ok: result.cached,
        detail: result.cached
          ? `${result.cacheKeyType} 바탕으로 캐시를 재사용했습니다.`
          : `${result.cacheKeyType} 재생성 응답입니다.`,
      },
      {
        key: 'yearly-generation-time',
        label: '생성 시간',
        ok: result.cached || result.generationMs <= 45_000,
        detail: result.cached
          ? '캐시 응답이라 생성 시간이 들지 않았습니다.'
          : `${result.generationMs}ms · ${result.stageResults.map(summarizeStage).join(' / ')}`,
      },
      {
        key: 'yearly-sections-complete',
        label: '필수 섹션 완성도',
        ok:
          result.interpretation.keywords.length >= 3 &&
          result.interpretation.monthlyFlows.length === 12 &&
          Boolean(result.interpretation.firstHalf) &&
          Boolean(result.interpretation.secondHalf) &&
          Boolean(result.interpretation.categories.work) &&
          Boolean(result.interpretation.categories.wealth) &&
          Boolean(result.interpretation.categories.love) &&
          Boolean(result.interpretation.categories.relationship) &&
          Boolean(result.interpretation.categories.health) &&
          Boolean(result.interpretation.categories.move) &&
          result.interpretation.actionAdvice.length >= 3 &&
          Boolean(result.interpretation.oneLineSummary),
        detail: `keywords ${result.interpretation.keywords.length}개 · monthly ${result.interpretation.monthlyFlows.length}개 · action ${result.interpretation.actionAdvice.length}개`,
      },
      {
        key: 'yearly-forbidden-phrases',
        label: '금지 문구 검사',
        ok: !hasForbiddenGuarantee(result.reportText),
        detail: hasForbiddenGuarantee(result.reportText)
          ? '무조건/반드시/100% 같은 단정 문구이 본문에 남아 있습니다.'
          : '단정 금지 문구는 발견되지 않았습니다.',
      },
      {
        key: 'yearly-ai-tone',
        label: 'AI스러운 말투 검사',
        ok: !hasAiLikeTone(result.reportText),
        detail: hasAiLikeTone(result.reportText)
          ? 'AI 비서 같은 메타 문구가 본문에 섞여 있습니다.'
          : '상담 문체를 깨는 메타 문구는 발견되지 않았습니다.',
      },
    ];

    return {
      generatedAt,
      status: 'ready' as const,
      slug,
      targetYear,
      counselorId: result.counselorId,
      readingId: result.readingId,
      resolvedReadingId: result.resolvedReadingId,
      readingSource: result.readingSource,
      promptVersion: result.promptVersion,
      cache: {
        cached: result.cached,
        cacheable: result.cacheable,
        cacheKeyType: result.cacheKeyType,
        cacheKeyDetail: describeCacheKeyType(result.cacheKeyType),
        updatedAt: result.updatedAt ?? null,
      },
      generation: {
        source: result.source,
        model: result.model,
        fallbackReason: result.fallbackReason,
        errorMessage: result.errorMessage,
        generationMs: result.generationMs,
        stageResults: result.stageResults,
      },
      interpretationSummary: {
        openingPreview: result.interpretation.opening.slice(0, 180),
        keywordCount: result.interpretation.keywords.length,
        monthlyCount: result.interpretation.monthlyFlows.length,
        reportLength: result.reportText.length,
      },
      schema,
      checks,
      warnings: checks.filter((check) => !check.ok).map((check) => check.detail),
      errors: [],
    };
  } catch (error) {
    return {
      generatedAt,
      status: 'error' as const,
      slug,
      targetYear,
      counselorId,
      schema,
      errors: [error instanceof Error ? error.message : '연간 리포트 검증을 만들지 못했습니다.'],
    };
  }
}
