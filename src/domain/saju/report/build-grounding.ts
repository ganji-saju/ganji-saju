import type { SajuDataV1, SajuYongsinCandidate } from '@/domain/saju/engine/saju-data-v1';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
import type { BirthInput } from '@/lib/saju/types';
import type { SajuReport } from './types';
import type {
  SajuEvidenceJson,
  SajuEvidenceSummaryCard,
  SajuEvidenceYongsinCandidate,
  SajuFactJson,
  SajuInterpretationGrounding,
} from './grounding-types';
import { SAJU_EVIDENCE_JSON_V1, SAJU_FACT_JSON_V1 } from './grounding-types';
import { buildSajuPersonalizationContext } from './personalization-context';

function getPrimaryConcept(report: SajuReport) {
  const primaryEvidence = report.evidenceCards.find((card) => card.key === 'yongsin') ?? report.evidenceCards[0];

  switch (primaryEvidence?.key) {
    case 'pattern':
      return '격국';
    case 'strength':
      return '강약';
    case 'relations':
      return '합충';
    case 'gongmang':
      return '공망';
    case 'specialSals':
      return '신살';
    case 'yongsin':
    default:
      return '용신';
  }
}

function formatYongsinSymbol(symbol: { label: string; value: string }) {
  // 2026-05-20 V2-5 PR V — saju-data-v1.formatElementLabel 이 자연 표기 ("화 기운")
  //   으로 전환됨. 추가 wrap (`(값)`) 은 본문 한자 노출 + `을(를)` 조사 fallback
  //   원인이라 제거. label 을 그대로 반환.
  return symbol.label;
}

function mapYongsinCandidate(candidate: SajuYongsinCandidate): SajuEvidenceYongsinCandidate {
  return {
    method: candidate.method,
    role: candidate.role,
    primary: formatYongsinSymbol(candidate.primary),
    support: candidate.secondary.map(formatYongsinSymbol),
    kiyshin: candidate.kiyshin.map(formatYongsinSymbol),
    score: candidate.score,
    rationale: candidate.rationale,
    plainSummary: candidate.plainSummary,
    technicalSummary: candidate.technicalSummary,
  };
}

function mapEvidenceCard(card: SajuReport['evidenceCards'][number]): SajuEvidenceSummaryCard {
  return {
    key: card.key,
    label: card.label,
    title: card.title,
    plainSummary: card.plainSummary || card.body,
    technicalSummary: card.technicalSummary ?? null,
    confidence: card.confidence,
    source: card.source,
    details: card.details,
  };
}

function buildFactJson(input: BirthInput, data: SajuDataV1 | SajuDataV2): SajuFactJson {
  return {
    schemaVersion: SAJU_FACT_JSON_V1,
    sajuDataVersion: data.schemaVersion,
    birthInput: {
      year: input.year,
      month: input.month,
      day: input.day,
      hour: input.hour ?? null,
      minute: input.minute ?? null,
      hourKnown: !input.unknownTime,
      gender: input.gender ?? null,
      birthLocationLabel: input.birthLocation?.label ?? null,
      birthLocationCode: input.birthLocation?.code ?? null,
      latitude: input.birthLocation?.latitude ?? null,
      longitude: input.birthLocation?.longitude ?? null,
      timezone: input.birthLocation?.timezone ?? null,
      solarTimeMode: input.solarTimeMode ?? null,
      jasiMethod: input.jasiMethod ?? null,
      birthTimeCorrectionMinutes: data.input.birthTimeCorrection?.offsetMinutes ?? null,
    },
    calendarConversion: {
      calendar: data.input.calendar,
      timezone: data.input.timezone,
      hourKnown: data.input.hourKnown,
      location: data.input.location ?? null,
      solarTimeMode: data.input.solarTimeMode ?? null,
      jasiMethod: data.input.jasiMethod ?? null,
      birthTimeCorrectionMinutes: data.input.birthTimeCorrection?.offsetMinutes ?? null,
    },
    pillars: data.pillars,
    dayMaster: {
      stem: data.dayMaster.stem,
      element: data.dayMaster.element,
      yinYang: data.dayMaster.yinYang,
      metaphor: data.dayMaster.metaphor ?? null,
      description: data.dayMaster.description ?? null,
    },
    fiveElements: data.fiveElements,
    tenGods: data.tenGods,
    strength: data.strength,
    pattern: data.pattern,
    yongsin: data.yongsin,
    luckCycles: {
      majorLuck: data.majorLuck,
      currentLuck: data.currentLuck,
    },
    relations: {
      relations: (data.extensions?.orrery?.relations ?? []).map((item) => ({
        category: item.category,
        label: item.label,
        source: item.source,
        target: item.target,
        detail: item.detail,
      })),
      gongmang: data.extensions?.orrery?.gongmang
        ? {
            branches: data.extensions.orrery.gongmang.branches,
            pillarSlots: data.extensions.orrery.gongmang.pillarSlots,
          }
        : null,
      specialSals: data.extensions?.orrery?.specialSals
        ? {
            yangin: data.extensions.orrery.specialSals.yangin,
            baekho: data.extensions.orrery.specialSals.baekho,
            goegang: data.extensions.orrery.specialSals.goegang,
            dohwa: data.extensions.orrery.specialSals.dohwa,
            cheonul: data.extensions.orrery.specialSals.cheonul,
            cheonduk: data.extensions.orrery.specialSals.cheonduk,
            wolduk: data.extensions.orrery.specialSals.wolduk,
            munchang: data.extensions.orrery.specialSals.munchang,
            hongyeom: data.extensions.orrery.specialSals.hongyeom,
            geumyeo: data.extensions.orrery.specialSals.geumyeo,
          }
        : null,
    },
    metadata: data.metadata,
  };
}

function buildEvidenceJson(data: SajuDataV1 | SajuDataV2, report: SajuReport): SajuEvidenceJson {
  return {
    schemaVersion: SAJU_EVIDENCE_JSON_V1,
    primaryConcept: getPrimaryConcept(report),
    strength: {
      level: data.strength?.level ?? null,
      score: data.strength?.score ?? null,
      rationale: data.strength?.rationale ?? [],
    },
    pattern: {
      name: data.pattern?.name ?? null,
      category: data.pattern?.category ?? null,
      tenGod: data.pattern?.tenGod ?? null,
      rationale: data.pattern?.rationale ?? [],
    },
    yongsin: {
      method: data.yongsin?.method ?? null,
      confidence: data.yongsin?.confidence ?? null,
      primary: data.yongsin?.primary ? formatYongsinSymbol(data.yongsin.primary) : null,
      support: data.yongsin?.secondary.map(formatYongsinSymbol) ?? [],
      kiyshin: data.yongsin?.kiyshin.map(formatYongsinSymbol) ?? [],
      rationale: data.yongsin?.rationale ?? [],
      practicalActions: data.yongsin?.practicalActions ?? [],
      candidates: data.yongsin?.candidates?.map(mapYongsinCandidate) ?? [],
    },
    luckFlow: {
      currentMajorLuck: data.currentLuck?.currentMajorLuck?.ganzi ?? null,
      currentMajorLuckNotes: data.currentLuck?.currentMajorLuck?.notes ?? [],
      saewoon: data.currentLuck?.saewoon?.ganzi ?? null,
      saewoonNotes: data.currentLuck?.saewoon?.notes ?? [],
      wolwoon: data.currentLuck?.wolwoon?.ganzi ?? null,
      wolwoonNotes: data.currentLuck?.wolwoon?.notes ?? [],
    },
    relations: {
      relations:
        data.extensions?.orrery?.relations?.map((item) =>
          [item.label, item.source, item.target, item.detail].filter(Boolean).join(' · ')
        ) ?? [],
      gongmang: data.extensions?.orrery?.gongmang?.branches ?? [],
      specialSals: [
        ...(data.extensions?.orrery?.specialSals?.yangin?.map((item) => `양인 ${item}`) ?? []),
        ...(data.extensions?.orrery?.specialSals?.dohwa?.map((item) => `도화 ${item}`) ?? []),
        ...(data.extensions?.orrery?.specialSals?.cheonul?.map((item) => `천을 ${item}`) ?? []),
        ...(data.extensions?.orrery?.specialSals?.cheonduk?.map((item) => `천덕 ${item}`) ?? []),
        ...(data.extensions?.orrery?.specialSals?.wolduk?.map((item) => `월덕 ${item}`) ?? []),
        ...(data.extensions?.orrery?.specialSals?.munchang?.map((item) => `문창 ${item}`) ?? []),
        ...(data.extensions?.orrery?.specialSals?.geumyeo?.map((item) => `금여 ${item}`) ?? []),
        ...(data.extensions?.orrery?.specialSals?.baekho ? ['백호'] : []),
        ...(data.extensions?.orrery?.specialSals?.goegang ? ['괴강'] : []),
        ...(data.extensions?.orrery?.specialSals?.hongyeom ? ['홍염'] : []),
      ],
    },
    classics: {
      cards: report.evidenceCards.map(mapEvidenceCard),
    },
  };
}

export function buildSajuInterpretationGrounding(
  input: BirthInput,
  data: SajuDataV1 | SajuDataV2,
  report: SajuReport,
  // 2026-05-15 PR 1: 사용자 입력 현재 상황 (연애/직업/고민) 전달 통로.
  // grounding 의 personalizationContext 까지 흘러 모든 풀이 화면이 같은 컨텍스트 수혜.
  userSituation: import('@/lib/saju/types').UserSituation | null = null
): SajuInterpretationGrounding {
  return {
    factJson: buildFactJson(input, data),
    evidenceJson: buildEvidenceJson(data, report),
    personalizationContext: buildSajuPersonalizationContext(data, userSituation),
  };
}
