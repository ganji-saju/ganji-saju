import {
  createPublicServerClient,
  createServiceClient,
  hasSupabaseServerEnv,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';
import type { ReportEvidenceKey } from '@/domain/saju/report';

export const DEFAULT_CLASSIC_EVIDENCE_LIMIT = 3;
const MAX_CLASSIC_EVIDENCE_LIMIT = 20;

export type ClassicEvidenceStatus =
  | 'ready'
  | 'missing-env'
  | 'db-error';

interface ClassicEvidenceRow {
  canonical_slug: string;
  canonical_title_zh_hant: string;
  canonical_title_ko: string;
  work_version_id: string;
  source_item_title: string;
  edition_name: string | null;
  edition_type: string;
  verification_status: string;
  public_release_status: string;
  section_id: string;
  section_path: string;
  section_title_zh: string;
  section_title_ko: string;
  passage_id: string;
  passage_no: number;
  original_text_zh: string;
  reading_ko: string | null;
  literal_translation_ko: string | null;
  commentary_ko: string | null;
  source_name: string;
  source_type: string;
  source_url: string | null;
  source_work_ref: string;
  effective_license_label: string | null;
  rank_score: number;
}

export interface ClassicEvidenceItem {
  work: {
    slug: string;
    titleZh: string;
    titleKo: string;
    versionId: string;
    sourceItemTitle: string;
    editionName: string | null;
    editionType: string;
  };
  section: {
    id: string;
    path: string;
    titleZh: string;
    titleKo: string;
  };
  passage: {
    id: string;
    no: number;
    originalZh: string;
    readingKo: string | null;
    literalKo: string | null;
    commentaryKo: string | null;
  };
  provenance: {
    sourceName: string;
    sourceType: string;
    sourceUrl: string | null;
    sourceRef: string;
    license: string | null;
    verificationStatus: string;
    publicReleaseStatus: string;
  };
  rankScore: number;
}

export interface ClassicEvidenceResult {
  concept: string;
  count: number;
  items: ClassicEvidenceItem[];
  status: ClassicEvidenceStatus;
  setupRequired: boolean;
  error?: string;
}

export function getClassicConceptForEvidenceKey(key: ReportEvidenceKey) {
  switch (key) {
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

export function normalizeClassicEvidenceQuery(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function clampClassicEvidenceLimit(limit: number | undefined) {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) {
    return DEFAULT_CLASSIC_EVIDENCE_LIMIT;
  }

  return Math.max(1, Math.min(MAX_CLASSIC_EVIDENCE_LIMIT, Math.trunc(limit)));
}

function mapClassicEvidenceRow(row: ClassicEvidenceRow): ClassicEvidenceItem {
  return {
    work: {
      slug: row.canonical_slug,
      titleZh: row.canonical_title_zh_hant,
      titleKo: row.canonical_title_ko,
      versionId: row.work_version_id,
      sourceItemTitle: row.source_item_title,
      editionName: row.edition_name,
      editionType: row.edition_type,
    },
    section: {
      id: row.section_id,
      path: row.section_path,
      titleZh: row.section_title_zh,
      titleKo: row.section_title_ko,
    },
    passage: {
      id: row.passage_id,
      no: row.passage_no,
      originalZh: row.original_text_zh,
      readingKo: row.reading_ko,
      literalKo: row.literal_translation_ko,
      commentaryKo: row.commentary_ko,
    },
    provenance: {
      sourceName: row.source_name,
      sourceType: row.source_type,
      sourceUrl: row.source_url,
      sourceRef: row.source_work_ref,
      license: row.effective_license_label,
      verificationStatus: row.verification_status,
      publicReleaseStatus: row.public_release_status,
    },
    rankScore: row.rank_score,
  };
}

export async function getClassicEvidence({
  concept,
  limit,
}: {
  concept: string;
  limit?: number;
}): Promise<ClassicEvidenceResult> {
  const normalizedConcept = normalizeClassicEvidenceQuery(concept);

  if (!hasSupabaseServerEnv) {
    return {
      concept: normalizedConcept,
      count: 0,
      items: [],
      status: 'missing-env',
      setupRequired: true,
      error: 'Supabase environment is not configured.',
    };
  }

  try {
    const supabase = hasSupabaseServiceEnv
      ? await createServiceClient()
      : createPublicServerClient();
    const { data, error } = await supabase.rpc('search_classic_evidence', {
      p_concept: normalizedConcept,
      p_limit: clampClassicEvidenceLimit(limit),
    });

    if (error) {
      return {
        concept: normalizedConcept,
        count: 0,
        items: [],
        status: 'db-error',
        setupRequired: true,
        error: error.message,
      };
    }

    const items = ((data ?? []) as ClassicEvidenceRow[]).map(mapClassicEvidenceRow);

    return {
      concept: normalizedConcept,
      count: items.length,
      items,
      status: 'ready',
      setupRequired: false,
    };
  } catch (error) {
    return {
      concept: normalizedConcept,
      count: 0,
      items: [],
      status: 'db-error',
      setupRequired: true,
      error: error instanceof Error ? error.message : 'Classic evidence lookup failed.',
    };
  }
}

export async function getClassicEvidenceBundle({
  concepts,
  limit,
}: {
  concepts: string[];
  limit?: number;
}) {
  const uniqueConcepts = [...new Set(concepts.map(normalizeClassicEvidenceQuery).filter(Boolean))];
  const entries = await Promise.all(
    uniqueConcepts.map(async (concept) => [
      concept,
      await getClassicEvidence({
        concept,
        limit,
      }),
    ] as const)
  );

  return Object.fromEntries(entries);
}
