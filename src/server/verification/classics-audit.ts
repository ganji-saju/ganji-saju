import {
  createServiceClient,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';
import { normalizeClassicEvidenceQuery } from '@/server/classics/evidence';

export const DEFAULT_CLASSICS_AUDIT_CONCEPT = '용신';

const EXPECTED_LIVE_REFS = [
  'title=滴天髓&normalizer=2',
  'title=穷通宝鉴',
  'title=三命通會_(四庫全書本)',
] as const;

const EXPECTED_HOLD_REFS = [
  'title=滴天髓', // superseded normalization; preserve its review history privately
  'title=三命通會',
  'title=淵海子平',
  'title=子平真詮',
  'ctp:wb631975',
  'ctp:wb727782',
  'ctp:wb221357',
  'ctp:wb346166',
  'ctp:wb758991',
] as const;

const MAX_AUDIT_EVIDENCE_LIMIT = 10;
const PAGE_SIZE = 1000;

type ClassicsAuditStatus = 'ready' | 'attention' | 'missing-env' | 'db-error';

interface ClassicWorkVersionRow {
  work_version_id: string;
  source_id: string;
  source_work_ref: string;
  source_url: string | null;
  source_item_title: string;
  edition_name: string | null;
  edition_type: string;
  completeness_status: string;
  verification_status: string;
  public_release_status: string;
  is_reference_only: boolean;
  source_last_verified_at: string | null;
  license_override: string | null;
}

interface ClassicSourceRow {
  source_id: string;
  source_name: string;
  base_url: string;
  license_label: string | null;
}

interface ClassicPassageAuditRow {
  passage_id: string;
  work_version_id: string;
  section_path: string | null;
  passage_no: number | null;
  original_text_zh: string | null;
  source_line_ref: string | null;
  provenance_hash: string | null;
  license_label: string | null;
  verification_status: string | null;
}

interface EvidenceRpcRow {
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

interface ConceptTagRow {
  concept_tag_id: string;
  concept_slug: string;
  concept_name_ko: string;
  concept_name_zh: string | null;
}

interface PassageConceptTagRow {
  passage_id: string;
  concept_tag_id: string;
  confidence: number | null;
}

export interface ClassicWorkAudit {
  sourceWorkRef: string;
  title: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  license: string | null;
  release: string | null;
  verification: string | null;
  completeness: string | null;
  referenceOnly: boolean;
  sourceLastVerifiedAt: string | null;
  sectionCount: number;
  passageCount: number;
  conceptTagCount: number;
  uiSummaryCount: number;
  requiredFieldMissingCount: number;
  expectedLive: boolean;
  expectedHold: boolean;
  ok: boolean;
  reason: string;
}

export interface ClassicHoldAudit {
  sourceWorkRef: string;
  title: string | null;
  release: string | null;
  verification: string | null;
  completeness: string | null;
  referenceOnly: boolean;
  ok: boolean;
  reason: string;
}

export interface ClassicGateCheck {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface ClassicEvidenceAuditItem {
  passageId: string;
  workTitleKo: string;
  sectionPath: string;
  passageNo: number;
  originalTextZh: string;
  commentaryKo: string | null;
  sourceName: string;
  sourceUrl: string | null;
  sourceRef: string;
  sourceLineRef: string | null;
  provenanceHash: string | null;
  license: string | null;
  verificationStatus: string;
  publicReleaseStatus: string;
  rankScore: number;
  conceptTags: Array<{
    slug: string;
    nameKo: string;
    nameZh: string | null;
    confidence: number | null;
  }>;
  hasRequestedConceptTag: boolean;
}

export interface ClassicIngestRunAudit {
  startedAt: string;
  jobName: string;
  status: string;
  recordsWritten: number;
  errorCount: number;
}

export interface ClassicsVerificationAudit {
  generatedAt: string;
  status: ClassicsAuditStatus;
  setupRequired: boolean;
  concept: string;
  expectedLiveRefs: string[];
  expectedHoldRefs: string[];
  overview: {
    liveWorkCount: number;
    livePassageCount: number;
    liveConceptTagCount: number;
    holdReferenceCount: number;
    latestIngestRunAt: string | null;
  };
  works: ClassicWorkAudit[];
  holds: ClassicHoldAudit[];
  gateChecks: ClassicGateCheck[];
  evidenceSamples: ClassicEvidenceAuditItem[];
  latestIngestRuns: ClassicIngestRunAudit[];
  errors: string[];
}

function clampLimit(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 5;
  return Math.max(1, Math.min(MAX_AUDIT_EVIDENCE_LIMIT, Math.trunc(value)));
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function chunk<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function effectiveLicense(version: ClassicWorkVersionRow, source: ClassicSourceRow | undefined) {
  return version.license_override ?? source?.license_label ?? null;
}

function hasRequiredPassageFields(row: ClassicPassageAuditRow) {
  return Boolean(
    row.section_path &&
      row.passage_no &&
      row.original_text_zh &&
      row.source_line_ref &&
      row.provenance_hash &&
      row.license_label &&
      row.verification_status
  );
}

function isReviewedEnough(status: string | null | undefined) {
  return status === 'reviewed' || status === 'provisional';
}

async function countRows(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  table: string,
  column = '*',
  filters: Array<[string, string | boolean]> = []
) {
  let query = supabase.from(table).select(column, { count: 'exact', head: true });
  for (const [key, value] of filters) {
    query = query.eq(key, value);
  }

  const { count, error } = await query;
  if (error) throw new Error(`Could not count ${table}: ${error.message}`);
  return count ?? 0;
}

async function loadRowsByWorkVersion<T>(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  table: string,
  select: string,
  workVersionId: string
) {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .eq('work_version_id', workVersionId)
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`Could not load ${table}: ${error.message}`);

    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

async function countConceptTagsForPassages(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  passageIds: string[]
) {
  let count = 0;

  for (const batch of chunk(passageIds, 100)) {
    if (batch.length === 0) continue;
    const { count: batchCount, error } = await supabase
      .from('classic_passage_concept_tags')
      .select('passage_id', { count: 'exact', head: true })
      .in('passage_id', batch);

    if (error) throw new Error(`Could not count concept tags: ${error.message}`);
    count += batchCount ?? 0;
  }

  return count;
}

async function loadLatestIngestRuns(supabase: Awaited<ReturnType<typeof createServiceClient>>) {
  const { data, error } = await supabase
    .from('classic_ingest_runs')
    .select('started_at, job_name, run_status, records_written, error_count')
    .order('started_at', { ascending: false })
    .limit(5);

  if (error) throw new Error(`Could not load latest ingest runs: ${error.message}`);

  return ((data ?? []) as Array<{
    started_at: string;
    job_name: string;
    run_status: string;
    records_written: number;
    error_count: number;
  }>).map((row) => ({
    startedAt: row.started_at,
    jobName: row.job_name,
    status: row.run_status,
    recordsWritten: row.records_written,
    errorCount: row.error_count,
  }));
}

async function auditWorkVersion(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  version: ClassicWorkVersionRow | undefined,
  source: ClassicSourceRow | undefined,
  sourceWorkRef: string,
  expectedLive: boolean,
  expectedHold: boolean
): Promise<ClassicWorkAudit> {
  if (!version) {
    return {
      sourceWorkRef,
      title: null,
      sourceName: null,
      sourceUrl: null,
      license: null,
      release: null,
      verification: null,
      completeness: null,
      referenceOnly: false,
      sourceLastVerifiedAt: null,
      sectionCount: 0,
      passageCount: 0,
      conceptTagCount: 0,
      uiSummaryCount: 0,
      requiredFieldMissingCount: 0,
      expectedLive,
      expectedHold,
      ok: false,
      reason: 'work_version_missing',
    };
  }

  const [sectionCount, passageRows, uiSummaryCount] = await Promise.all([
    countRows(supabase, 'classic_sections', 'section_id', [
      ['work_version_id', version.work_version_id],
    ]),
    loadRowsByWorkVersion<ClassicPassageAuditRow>(
      supabase,
      'classic_passages',
      'passage_id, work_version_id, section_path, passage_no, original_text_zh, source_line_ref, provenance_hash, license_label, verification_status',
      version.work_version_id
    ),
    countRows(supabase, 'classic_commentaries', 'commentary_id', [
      ['work_version_id', version.work_version_id],
      ['commentary_type', 'ui_summary'],
    ]),
  ]);
  const passageIds = passageRows.map((row) => row.passage_id);
  const conceptTagCount = await countConceptTagsForPassages(supabase, passageIds);
  const missingRequired = passageRows.filter((row) => !hasRequiredPassageFields(row)).length;
  const license = effectiveLicense(version, source);

  const liveOk =
    version.public_release_status === 'live' &&
    isReviewedEnough(version.verification_status) &&
    version.completeness_status === 'complete' &&
    !version.is_reference_only &&
    Boolean(version.source_url) &&
    Boolean(license) &&
    sectionCount > 0 &&
    passageRows.length > 0 &&
    missingRequired === 0;
  const holdOk = version.is_reference_only && (
    sourceWorkRef === 'title=滴天髓'
      ? ['hold', 'internal'].includes(version.public_release_status)
      : version.public_release_status === 'hold' && !isReviewedEnough(version.verification_status)
  );
  const ok = expectedLive ? liveOk : expectedHold ? holdOk : true;

  return {
    sourceWorkRef,
    title: version.source_item_title,
    sourceName: source?.source_name ?? null,
    sourceUrl: version.source_url,
    license,
    release: version.public_release_status,
    verification: version.verification_status,
    completeness: version.completeness_status,
    referenceOnly: version.is_reference_only,
    sourceLastVerifiedAt: version.source_last_verified_at,
    sectionCount,
    passageCount: passageRows.length,
    conceptTagCount,
    uiSummaryCount,
    requiredFieldMissingCount: missingRequired,
    expectedLive,
    expectedHold,
    ok,
    reason: ok
      ? 'ok'
      : expectedLive
        ? 'live_work_not_ready_or_missing_provenance'
        : 'hold_work_not_blocked_reference_only',
  };
}

async function loadEvidenceSamples(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  concept: string,
  limit: number
) {
  const { data, error } = await supabase.rpc('search_classic_evidence', {
    p_concept: concept,
    p_limit: limit,
  });

  if (error) throw new Error(`Evidence API lookup failed: ${error.message}`);

  const rows = (data ?? []) as EvidenceRpcRow[];
  const passageIds = unique(rows.map((row) => row.passage_id));

  const passageById = new Map<string, ClassicPassageAuditRow>();
  const tagsByPassageId = new Map<string, PassageConceptTagRow[]>();
  const tagById = new Map<string, ConceptTagRow>();

  if (passageIds.length > 0) {
    const { data: passageRows, error: passageError } = await supabase
      .from('classic_passages')
      .select('passage_id, work_version_id, section_path, passage_no, original_text_zh, source_line_ref, provenance_hash, license_label, verification_status')
      .in('passage_id', passageIds);

    if (passageError) {
      throw new Error(`Could not load evidence passage provenance: ${passageError.message}`);
    }

    for (const row of (passageRows ?? []) as ClassicPassageAuditRow[]) {
      passageById.set(row.passage_id, row);
    }

    const { data: tagRows, error: tagError } = await supabase
      .from('classic_passage_concept_tags')
      .select('passage_id, concept_tag_id, confidence')
      .in('passage_id', passageIds);

    if (tagError) throw new Error(`Could not load evidence concept tags: ${tagError.message}`);

    const passageTagRows = (tagRows ?? []) as PassageConceptTagRow[];
    const tagIds = unique(passageTagRows.map((row) => row.concept_tag_id));
    for (const row of passageTagRows) {
      const current = tagsByPassageId.get(row.passage_id) ?? [];
      current.push(row);
      tagsByPassageId.set(row.passage_id, current);
    }

    if (tagIds.length > 0) {
      const { data: conceptRows, error: conceptError } = await supabase
        .from('classic_concept_tags')
        .select('concept_tag_id, concept_slug, concept_name_ko, concept_name_zh')
        .in('concept_tag_id', tagIds);

      if (conceptError) throw new Error(`Could not load concept tag labels: ${conceptError.message}`);

      for (const row of (conceptRows ?? []) as ConceptTagRow[]) {
        tagById.set(row.concept_tag_id, row);
      }
    }
  }

  return rows.map((row): ClassicEvidenceAuditItem => {
    const passage = passageById.get(row.passage_id);
    const conceptTags = (tagsByPassageId.get(row.passage_id) ?? [])
      .map((tagRow) => {
        const tag = tagById.get(tagRow.concept_tag_id);
        if (!tag) return null;

        return {
          slug: tag.concept_slug,
          nameKo: tag.concept_name_ko,
          nameZh: tag.concept_name_zh,
          confidence: tagRow.confidence,
        };
      })
      .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag));
    const hasRequestedConceptTag = conceptTags.some(
      (tag) =>
        tag.slug === concept ||
        tag.nameKo === concept ||
        tag.nameZh === concept
    );

    return {
      passageId: row.passage_id,
      workTitleKo: row.canonical_title_ko,
      sectionPath: row.section_path,
      passageNo: row.passage_no,
      originalTextZh: row.original_text_zh,
      commentaryKo: row.commentary_ko,
      sourceName: row.source_name,
      sourceUrl: row.source_url,
      sourceRef: row.source_work_ref,
      sourceLineRef: passage?.source_line_ref ?? null,
      provenanceHash: passage?.provenance_hash ?? null,
      license: row.effective_license_label,
      verificationStatus: row.verification_status,
      publicReleaseStatus: row.public_release_status,
      rankScore: row.rank_score,
      conceptTags,
      hasRequestedConceptTag,
    };
  });
}

function buildGateChecks(items: ClassicEvidenceAuditItem[]) {
  return [
    {
      key: 'only-live',
      label: 'API 노출은 live 버전만',
      ok: items.every((item) => item.publicReleaseStatus === 'live'),
      detail: `${items.length}개 샘플 검사`,
    },
    {
      key: 'reviewed-or-provisional',
      label: '검수 상태는 provisional/reviewed만',
      ok: items.every((item) => isReviewedEnough(item.verificationStatus)),
      detail: `${items.length}개 샘플 검사`,
    },
    {
      key: 'has-provenance',
      label: 'source URL/ref/hash/license 존재',
      ok: items.every(
        (item) =>
          item.sourceUrl &&
          item.sourceRef &&
          item.sourceLineRef &&
          item.provenanceHash &&
          item.license
      ),
      detail: `${items.length}개 샘플 검사`,
    },
    {
      key: 'tag-gated',
      label: '요청 개념 태그가 있는 passage만',
      ok: items.every((item) => item.hasRequestedConceptTag),
      detail: `${items.length}개 샘플 검사`,
    },
  ];
}

function buildHoldRows(works: ClassicWorkAudit[]): ClassicHoldAudit[] {
  return works
    .filter((work) => work.expectedHold)
    .map((work) => ({
      sourceWorkRef: work.sourceWorkRef,
      title: work.title,
      release: work.release,
      verification: work.verification,
      completeness: work.completeness,
      referenceOnly: work.referenceOnly,
      ok: work.ok,
      reason: work.reason,
    }));
}

export async function getClassicsVerificationAudit({
  concept = DEFAULT_CLASSICS_AUDIT_CONCEPT,
  limit,
}: {
  concept?: string;
  limit?: number;
} = {}): Promise<ClassicsVerificationAudit> {
  const normalizedConcept =
    normalizeClassicEvidenceQuery(concept) || DEFAULT_CLASSICS_AUDIT_CONCEPT;
  const generatedAt = new Date().toISOString();

  if (!hasSupabaseServiceEnv) {
    return {
      generatedAt,
      status: 'missing-env',
      setupRequired: true,
      concept: normalizedConcept,
      expectedLiveRefs: [...EXPECTED_LIVE_REFS],
      expectedHoldRefs: [...EXPECTED_HOLD_REFS],
      overview: {
        liveWorkCount: 0,
        livePassageCount: 0,
        liveConceptTagCount: 0,
        holdReferenceCount: 0,
        latestIngestRunAt: null,
      },
      works: [],
      holds: [],
      gateChecks: [],
      evidenceSamples: [],
      latestIngestRuns: [],
      errors: ['Supabase service environment is not configured.'],
    };
  }

  try {
    const supabase = await createServiceClient();
    const expectedRefs = unique([...EXPECTED_LIVE_REFS, ...EXPECTED_HOLD_REFS]);
    const { data: versionRows, error: versionError } = await supabase
      .from('classic_work_versions')
      .select('work_version_id, source_id, source_work_ref, source_url, source_item_title, edition_name, edition_type, completeness_status, verification_status, public_release_status, is_reference_only, source_last_verified_at, license_override')
      .in('source_work_ref', expectedRefs);

    if (versionError) {
      throw new Error(`Could not load classic work versions: ${versionError.message}`);
    }

    const versions = (versionRows ?? []) as ClassicWorkVersionRow[];
    const versionByRef = new Map(versions.map((row) => [row.source_work_ref, row]));
    const sourceIds = unique(versions.map((row) => row.source_id));
    const sourceById = new Map<string, ClassicSourceRow>();

    if (sourceIds.length > 0) {
      const { data: sourceRows, error: sourceError } = await supabase
        .from('classic_sources')
        .select('source_id, source_name, base_url, license_label')
        .in('source_id', sourceIds);

      if (sourceError) throw new Error(`Could not load classic sources: ${sourceError.message}`);

      for (const row of (sourceRows ?? []) as ClassicSourceRow[]) {
        sourceById.set(row.source_id, row);
      }
    }

    const works = await Promise.all(
      expectedRefs.map((sourceWorkRef) => {
        const version = versionByRef.get(sourceWorkRef);
        return auditWorkVersion(
          supabase,
          version,
          version ? sourceById.get(version.source_id) : undefined,
          sourceWorkRef,
          EXPECTED_LIVE_REFS.includes(sourceWorkRef as (typeof EXPECTED_LIVE_REFS)[number]),
          EXPECTED_HOLD_REFS.includes(sourceWorkRef as (typeof EXPECTED_HOLD_REFS)[number])
        );
      })
    );
    const evidenceSamples = await loadEvidenceSamples(
      supabase,
      normalizedConcept,
      clampLimit(limit)
    );
    const latestIngestRuns = await loadLatestIngestRuns(supabase);
    const gateChecks = buildGateChecks(evidenceSamples);
    const liveWorks = works.filter((work) => work.expectedLive);
    const holdRows = buildHoldRows(works);
    const allChecksOk =
      works.every((work) => work.ok) &&
      gateChecks.every((check) => check.ok) &&
      evidenceSamples.length > 0;

    return {
      generatedAt,
      status: allChecksOk ? 'ready' : 'attention',
      setupRequired: false,
      concept: normalizedConcept,
      expectedLiveRefs: [...EXPECTED_LIVE_REFS],
      expectedHoldRefs: [...EXPECTED_HOLD_REFS],
      overview: {
        liveWorkCount: liveWorks.filter((work) => work.ok).length,
        livePassageCount: liveWorks.reduce((sum, work) => sum + work.passageCount, 0),
        liveConceptTagCount: liveWorks.reduce((sum, work) => sum + work.conceptTagCount, 0),
        holdReferenceCount: holdRows.filter((row) => row.ok).length,
        latestIngestRunAt: latestIngestRuns[0]?.startedAt ?? null,
      },
      works: liveWorks,
      holds: holdRows,
      gateChecks,
      evidenceSamples,
      latestIngestRuns,
      errors: allChecksOk ? [] : ['One or more verification checks need attention.'],
    };
  } catch (error) {
    return {
      generatedAt,
      status: 'db-error',
      setupRequired: true,
      concept: normalizedConcept,
      expectedLiveRefs: [...EXPECTED_LIVE_REFS],
      expectedHoldRefs: [...EXPECTED_HOLD_REFS],
      overview: {
        liveWorkCount: 0,
        livePassageCount: 0,
        liveConceptTagCount: 0,
        holdReferenceCount: 0,
        latestIngestRunAt: null,
      },
      works: [],
      holds: [],
      gateChecks: [],
      evidenceSamples: [],
      latestIngestRuns: [],
      errors: [error instanceof Error ? error.message : 'Classics verification failed.'],
    };
  }
}
