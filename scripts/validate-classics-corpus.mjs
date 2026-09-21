#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createSupabaseServiceClient,
  loadLocalEnv,
} from './lib/classics/upsert-classic-corpus.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const EXPECTED_WIKISOURCE_REFS = [
  'title=滴天髓&normalizer=2',
  'title=穷通宝鉴',
  'title=三命通會_(四庫全書本)',
];

const EXPECTED_PUBLIC_HOLD_REFS = [
  'title=滴天髓', // superseded normalization; retained privately, never deleted
  'title=三命通會',
  'title=淵海子平',
  'title=子平真詮',
  'ctp:wb631975',
  'ctp:wb727782',
  'ctp:wb221357',
  'ctp:wb346166',
  'ctp:wb758991',
];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  loadLocalEnv(projectRoot);
  const supabase = createSupabaseServiceClient();

  const rows = [];
  for (const sourceWorkRef of EXPECTED_WIKISOURCE_REFS) {
    rows.push(await validateWorkVersion(supabase, sourceWorkRef));
  }

  const orphanCount = await countOrphanPassages(supabase);
  const suspectCount = await countSuspectPassages(supabase);
  const latestRuns = await loadLatestRuns(supabase);
  const holdRows = await validatePublicHoldWorkVersions(supabase);
  const missingCatalogProvenanceCount = await countMissingCatalogProvenance(supabase);
  const apiGateAudit = await validateEvidenceApiGate(supabase);

  console.table(rows);
  console.table(holdRows);
  console.log(`orphan_passages=${orphanCount}`);
  console.log(`suspect_passages=${suspectCount}`);
  console.log(`missing_catalog_provenance_passages=${missingCatalogProvenanceCount}`);
  console.log(`api_non_live_or_unreviewed_results=${apiGateAudit.nonLiveOrUnreviewedCount}`);
  console.log(`api_untagged_results=${apiGateAudit.untaggedCount}`);
  console.log('latest_ingest_runs=');
  for (const run of latestRuns) {
    console.log(
      `  ${run.started_at} ${run.job_name} ${run.run_status} records=${run.records_written} errors=${run.error_count}`
    );
  }

  const minPassages = Number.parseInt(args.minPassages, 10);
  const minUiSummaries = Number.parseInt(args.minUiSummaries, 10);
  const tooSmall = rows.filter((row) => row.passage_count < minPassages);
  const tooFewUiSummaries = rows.filter((row) => row.ui_summary_count < minUiSummaries);
  const missingRequired = rows.filter((row) => row.required_field_missing_count > 0);
  const invalidHolds = holdRows.filter((row) => !row.valid_hold);
  const invalidLive = rows.filter((row) => !row.valid_live);
  if (invalidLive.length > 0) {
    console.error(`Expected public, verified source versions: ${invalidLive.map((row) => row.source_work_ref).join(', ')}`);
    process.exit(1);
  }
  if (tooSmall.length > 0) {
    console.error(
      `Expected at least ${minPassages} passages for each work, but these were too small: ${tooSmall
        .map((row) => row.source_work_ref)
        .join(', ')}`
    );
    process.exit(1);
  }

  if (tooFewUiSummaries.length > 0) {
    console.error(
      `Expected at least ${minUiSummaries} UI summaries for each work, but these were too small: ${tooFewUiSummaries
        .map((row) => `${row.source_work_ref}=${row.ui_summary_count}`)
        .join(', ')}`
    );
    process.exit(1);
  }

  if (missingRequired.length > 0) {
    console.error(
      `Missing required passage provenance fields: ${missingRequired
        .map((row) => `${row.source_work_ref}=${row.required_field_missing_count}`)
        .join(', ')}`
    );
    process.exit(1);
  }

  if (orphanCount > 0) {
    console.error('Found orphan classic_passages rows.');
    process.exit(1);
  }

  if (invalidHolds.length > 0) {
    console.error(
      `Expected public hold/reference-only rows, but these failed: ${invalidHolds
        .map((row) => `${row.source_work_ref}:${row.reason}`)
        .join(', ')}`
    );
    process.exit(1);
  }

  if (missingCatalogProvenanceCount > 0) {
    console.error('Found passages missing source/version/license/provenance fields.');
    process.exit(1);
  }

  if (apiGateAudit.nonLiveOrUnreviewedCount > 0) {
    console.error('Evidence API returned non-live or unreviewed/blocked rows.');
    process.exit(1);
  }

  if (apiGateAudit.untaggedCount > 0) {
    console.error('Evidence API returned rows not tagged with the requested concept.');
    process.exit(1);
  }
}

function parseArgs(argv) {
  const args = {
    minPassages: '1',
    minUiSummaries: '0',
  };

  for (const arg of argv) {
    if (arg.startsWith('--min-passages=')) {
      args.minPassages = arg.slice('--min-passages='.length);
    } else if (arg.startsWith('--min-ui-summaries=')) {
      args.minUiSummaries = arg.slice('--min-ui-summaries='.length);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

async function validateWorkVersion(supabase, sourceWorkRef) {
  const { data: version, error: versionError } = await supabase
    .from('classic_work_versions')
    .select('work_version_id, source_work_ref, source_item_title, public_release_status, verification_status, is_reference_only, completeness_status')
    .eq('source_work_ref', sourceWorkRef)
    .single();

  if (versionError) {
    throw new Error(`Missing work version ${sourceWorkRef}: ${versionError.message}`);
  }

  const { count: sectionCount, error: sectionError } = await supabase
    .from('classic_sections')
    .select('section_id', { count: 'exact', head: true })
    .eq('work_version_id', version.work_version_id);

  if (sectionError) {
    throw new Error(`Could not count sections for ${sourceWorkRef}: ${sectionError.message}`);
  }

  const { count: passageCount, error: passageError } = await supabase
    .from('classic_passages')
    .select('passage_id', { count: 'exact', head: true })
    .eq('work_version_id', version.work_version_id);

  if (passageError) {
    throw new Error(`Could not count passages for ${sourceWorkRef}: ${passageError.message}`);
  }

  return {
    source_work_ref: version.source_work_ref,
    title: version.source_item_title,
    release: version.public_release_status,
    verification: version.verification_status,
    valid_live: version.public_release_status === 'live'
      && ['reviewed', 'provisional'].includes(version.verification_status)
      && version.is_reference_only === false && version.completeness_status === 'complete',
    section_count: sectionCount ?? 0,
    passage_count: passageCount ?? 0,
    concept_tag_count: await countConceptTagsForWorkVersion(
      supabase,
      version.work_version_id
    ),
    ui_summary_count: await countUiSummariesForWorkVersion(
      supabase,
      version.work_version_id
    ),
    required_field_missing_count: await countMissingRequiredPassageFields(
      supabase,
      version.work_version_id
    ),
  };
}

async function countUiSummariesForWorkVersion(supabase, workVersionId) {
  const { count, error } = await supabase
    .from('classic_commentaries')
    .select('commentary_id', { count: 'exact', head: true })
    .eq('work_version_id', workVersionId)
    .eq('commentary_type', 'ui_summary');

  if (error) {
    throw new Error(`Could not count UI summaries: ${error.message}`);
  }

  return count ?? 0;
}

async function countMissingRequiredPassageFields(supabase, workVersionId) {
  const passageRows = await loadAllRows(
    supabase,
    'classic_passages',
    [
      'passage_id',
      'work_version_id',
      'section_path',
      'passage_no',
      'original_text_zh',
      'source_line_ref',
      'provenance_hash',
      'license_label',
      'verification_status',
    ].join(', ')
  );

  return passageRows.filter(
    (row) =>
      row.work_version_id === workVersionId &&
      (!row.section_path ||
        !row.passage_no ||
        !row.original_text_zh ||
        !row.source_line_ref ||
        !row.provenance_hash ||
        !row.license_label ||
        !row.verification_status)
  ).length;
}

async function countConceptTagsForWorkVersion(supabase, workVersionId) {
  const passageRows = await loadAllRows(
    supabase,
    'classic_passages',
    'passage_id, work_version_id'
  );
  const passageIds = passageRows
    .filter((row) => row.work_version_id === workVersionId)
    .map((row) => row.passage_id);

  let count = 0;
  for (const batch of chunk(passageIds, 100)) {
    const { count: batchCount, error } = await supabase
      .from('classic_passage_concept_tags')
      .select('passage_id', { count: 'exact', head: true })
      .in('passage_id', batch);

    if (error) {
      throw new Error(`Could not count concept tags: ${error.message}`);
    }

    count += batchCount ?? 0;
  }

  return count;
}

async function countOrphanPassages(supabase) {
  const sectionRows = await loadAllRows(supabase, 'classic_sections', 'section_id');
  const sectionIds = new Set(sectionRows.map((row) => row.section_id));
  const passageRows = await loadAllRows(supabase, 'classic_passages', 'passage_id, section_id');

  return passageRows.filter((row) => !sectionIds.has(row.section_id)).length;
}

async function countSuspectPassages(supabase) {
  const { count, error } = await supabase
    .from('classic_passages')
    .select('passage_id', { count: 'exact', head: true })
    .eq('is_suspect', true);

  if (error) {
    throw new Error(`Could not count suspect passages: ${error.message}`);
  }

  return count ?? 0;
}

async function validatePublicHoldWorkVersions(supabase) {
  const { data, error } = await supabase
    .from('classic_work_versions')
    .select(
      'source_work_ref, public_release_status, verification_status, completeness_status, is_reference_only'
    )
    .in('source_work_ref', EXPECTED_PUBLIC_HOLD_REFS);

  if (error) {
    throw new Error(`Could not load public hold work versions: ${error.message}`);
  }

  const byRef = new Map((data ?? []).map((row) => [row.source_work_ref, row]));

  return EXPECTED_PUBLIC_HOLD_REFS.map((sourceWorkRef) => {
    const row = byRef.get(sourceWorkRef);
    if (!row) {
      return {
        source_work_ref: sourceWorkRef,
        release: null,
        verification: null,
        completeness: null,
        reference_only: false,
        valid_hold: false,
        reason: 'missing',
      };
    }

    const validHold = row.is_reference_only === true && (
      sourceWorkRef === 'title=滴天髓'
        ? ['hold', 'internal'].includes(row.public_release_status)
        : row.public_release_status === 'hold' &&
          row.verification_status !== 'reviewed' &&
          row.verification_status !== 'provisional'
    );

    return {
      source_work_ref: row.source_work_ref,
      release: row.public_release_status,
      verification: row.verification_status,
      completeness: row.completeness_status,
      reference_only: row.is_reference_only,
      valid_hold: validHold,
      reason: validHold ? 'ok' : 'not_hold_reference_only',
    };
  });
}

async function countMissingCatalogProvenance(supabase) {
  const passageRows = await loadAllRows(
    supabase,
    'classic_passages',
    'passage_id, work_version_id, source_line_ref, provenance_hash, license_label'
  );
  const versionRows = await loadAllRows(
    supabase,
    'classic_work_versions',
    'work_version_id, source_id, source_url, source_work_ref, license_override'
  );
  const sourceRows = await loadAllRows(
    supabase,
    'classic_sources',
    'source_id, license_label'
  );

  const versionById = new Map(versionRows.map((row) => [row.work_version_id, row]));
  const sourceById = new Map(sourceRows.map((row) => [row.source_id, row]));

  return passageRows.filter((passage) => {
    const version = versionById.get(passage.work_version_id);
    const source = version ? sourceById.get(version.source_id) : null;
    const effectiveLicense = version?.license_override ?? source?.license_label ?? null;

    return (
      !version ||
      !source ||
      !version.source_url ||
      !version.source_work_ref ||
      !effectiveLicense ||
      !passage.source_line_ref ||
      !passage.provenance_hash ||
      !passage.license_label
    );
  }).length;
}

async function validateEvidenceApiGate(supabase) {
  const conceptTags = await loadAllRows(
    supabase,
    'classic_concept_tags',
    'concept_tag_id, concept_slug, concept_name_ko, concept_name_zh'
  );
  const tagRows = await loadAllRows(
    supabase,
    'classic_passage_concept_tags',
    'passage_id, concept_tag_id'
  );
  const tagIdsByPassageId = new Map();

  for (const tagRow of tagRows) {
    const tagIds = tagIdsByPassageId.get(tagRow.passage_id) ?? new Set();
    tagIds.add(tagRow.concept_tag_id);
    tagIdsByPassageId.set(tagRow.passage_id, tagIds);
  }

  let nonLiveOrUnreviewedCount = 0;
  let untaggedCount = 0;

  for (const tag of conceptTags) {
    const queries = [
      tag.concept_slug,
      tag.concept_name_ko,
      tag.concept_name_zh,
    ].filter(Boolean);

    for (const query of queries) {
      const { data, error } = await supabase.rpc('search_classic_evidence', {
        p_concept: query,
        p_limit: 20,
      });

      if (error) {
        throw new Error(`Evidence API gate check failed for ${query}: ${error.message}`);
      }

      for (const row of data ?? []) {
        if (
          row.public_release_status !== 'live' ||
          !['reviewed', 'provisional'].includes(row.verification_status)
        ) {
          nonLiveOrUnreviewedCount += 1;
        }

        const passageTagIds = tagIdsByPassageId.get(row.passage_id);
        if (!passageTagIds?.has(tag.concept_tag_id)) {
          untaggedCount += 1;
        }
      }
    }
  }

  return {
    nonLiveOrUnreviewedCount,
    untaggedCount,
  };
}

async function loadLatestRuns(supabase) {
  const { data, error } = await supabase
    .from('classic_ingest_runs')
    .select('started_at, job_name, run_status, records_written, error_count')
    .order('started_at', { ascending: false })
    .limit(8);

  if (error) {
    throw new Error(`Could not load latest ingest runs: ${error.message}`);
  }

  return data ?? [];
}

async function loadAllRows(supabase, table, select) {
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(from, from + 999);

    if (error) {
      throw new Error(`Could not load ${table}: ${error.message}`);
    }

    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
    from += 1000;
  }

  return rows;
}

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
