import { generateLifetimeInterpretation } from '@/server/ai/saju-lifetime-service';

const DEFAULT_LIFETIME_AUDIT_SLUG = '1982-1-29-8-male';
const DEFAULT_LIFETIME_AUDIT_YEAR = 2026;

export type LifetimeAuditStatus = 'ready' | 'not-found' | 'error';

export interface LifetimeVerificationCheck {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
}

function summarizeStage(stage: { key: string; source: string; durationMs: number; fallbackReason: string | null }) {
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

export async function getLifetimeVerificationAudit({
  slug = DEFAULT_LIFETIME_AUDIT_SLUG,
  targetYear = DEFAULT_LIFETIME_AUDIT_YEAR,
  counselorId = 'female',
}: {
  slug?: string;
  targetYear?: number;
  counselorId?: 'female' | 'male';
} = {}) {
  const generatedAt = new Date().toISOString();

  try {
    const result = await generateLifetimeInterpretation({
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
        errors: ['깊은 사주풀이를 만들 대상 사주 결과를 찾지 못했습니다.'],
      };
    }

    const checks: LifetimeVerificationCheck[] = [
      {
        key: 'lifetime-api-response',
        label: '깊은 사주풀이 API 응답',
        ok: true,
        detail: `${result.targetYear}년 깊은 사주풀이 응답이 생성되었습니다.`,
      },
      {
        key: 'lifetime-openai-source',
        label: 'OpenAI 생성 여부',
        ok: result.source === 'openai',
        detail:
          result.source === 'openai'
            ? '깊은 사주풀이가 정밀 해석 단계 생성으로 완료되었습니다.'
            : `현재는 ${result.fallbackReason ?? 'fallback'} 사유로 fallback입니다.`,
      },
      {
        key: 'lifetime-sections-complete',
        label: '필수 섹션 완성도',
        ok:
          result.interpretation.keywords.length >= 3 &&
          result.interpretation.rememberRules.length === 5 &&
          Boolean(result.interpretation.sections.coreIdentity) &&
          Boolean(result.interpretation.sections.strengthBalance) &&
          Boolean(result.interpretation.sections.patternAndYongsin) &&
          Boolean(result.interpretation.sections.relationshipPattern) &&
          Boolean(result.interpretation.sections.wealthStyle) &&
          Boolean(result.interpretation.sections.careerDirection) &&
          Boolean(result.interpretation.sections.healthRhythm) &&
          Boolean(result.interpretation.sections.majorLuckTimeline) &&
          Boolean(result.interpretation.sections.lifetimeStrategy),
        detail: `keywords ${result.interpretation.keywords.length}개 · rules ${result.interpretation.rememberRules.length}개`,
      },
      {
        key: 'lifetime-major-luck',
        label: '대운 10년 흐름 지도',
        ok: result.report.majorLuckTimeline.cycles.length >= 1,
        detail: `majorLuck cycles ${result.report.majorLuckTimeline.cycles.length}개`,
      },
      {
        key: 'lifetime-yearly-appendix',
        label: '올해 부록 연결',
        ok:
          result.report.yearlyAppendix.year === targetYear &&
          result.report.yearlyAppendix.goodPeriods.length >= 1 &&
          result.report.yearlyAppendix.cautionPeriods.length >= 1,
        detail: `${result.report.yearlyAppendix.yearLabel} · CTA ${result.report.yearlyAppendix.ctaAnchor}`,
      },
      {
        key: 'lifetime-generation-time',
        label: '생성 시간',
        ok: result.generationMs <= 45_000,
        detail: `${result.generationMs}ms · ${result.stageResults.map(summarizeStage).join(' / ')}`,
      },
      {
        key: 'lifetime-forbidden-phrases',
        label: '금지 문구 검사',
        ok: !hasForbiddenGuarantee(result.reportText),
        detail: hasForbiddenGuarantee(result.reportText)
          ? '무조건/반드시/100% 같은 단정 문구이 본문에 남아 있습니다.'
          : '단정 금지 문구은 발견되지 않았습니다.',
      },
      {
        key: 'lifetime-ai-tone',
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
      generation: {
        source: result.source,
        model: result.model,
        fallbackReason: result.fallbackReason,
        errorMessage: result.errorMessage,
        generationMs: result.generationMs,
        stageResults: result.stageResults,
      },
      interpretationSummary: {
        keywordCount: result.interpretation.keywords.length,
        rememberRuleCount: result.interpretation.rememberRules.length,
        reportLength: result.reportText.length,
        openingPreview: result.interpretation.opening.slice(0, 180),
        yearlyAppendixYear: result.report.yearlyAppendix.year,
      },
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
      errors: [error instanceof Error ? error.message : '깊은 사주풀이 검증을 만들지 못했습니다.'],
    };
  }
}
