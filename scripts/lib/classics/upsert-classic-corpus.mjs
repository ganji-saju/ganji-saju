import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';

export function loadLocalEnv(projectRoot) {
  nextEnv.loadEnvConfig(projectRoot, process.env.NODE_ENV !== 'production', {
    info() {},
    error() { throw new Error('Could not load local environment files.'); },
  });
}

export function createSupabaseServiceClient() {
  const firstValue = (...keys) => keys.map((key) => process.env[key]?.trim())
    .find((value) => value && value !== '""' && value !== "''");
  const supabaseUrl = firstValue('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL');
  const serviceRoleKey = firstValue('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Supabase URL and service-role/secret key are required for corpus access.'
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function upsertClassicWorkCorpus({ supabase, collected, replace = false }) {
  const workVersion = await loadWorkVersion(supabase, collected.work.sourceWorkRef);
  const licenseLabel = await loadEffectiveLicenseLabel(supabase, workVersion);
  const ingestRun = await startIngestRun({
    supabase,
    sourceId: workVersion.source_id,
    workVersionId: workVersion.work_version_id,
    jobName: `wikisource:${collected.work.key}`,
  });

  try {
    const existingPassages = await loadExistingPassages(supabase, workVersion.work_version_id);
    if (!replace) assertUnchangedPassages(collected.passages, existingPassages);
    if (replace) {
      await assertNoReviewedDerivedRows(supabase, workVersion.work_version_id);
      await deleteExistingPassages(supabase, workVersion.work_version_id);
      await deleteExistingSections(supabase, workVersion.work_version_id);
    }

    const sectionIdByKey = await upsertSections({
      supabase,
      workVersionId: workVersion.work_version_id,
      sections: collected.sections,
    });
    const sectionByKey = new Map(
      collected.sections.map((section) => [section.sectionKey, section])
    );

    const passageInputs = collected.passages.map((passage) => {
      const section = sectionByKey.get(passage.sectionKey);
      const sectionId = sectionIdByKey.get(passage.sectionKey);
      if (!sectionId) {
        throw new Error(`Missing section id for passage section key ${passage.sectionKey}`);
      }
      if (!section) {
        throw new Error(`Missing section metadata for passage section key ${passage.sectionKey}`);
      }

      return {
        conceptSlugs: passage.conceptSlugs ?? [],
        row: {
          work_version_id: workVersion.work_version_id,
          section_id: sectionId,
          passage_no: passage.passageNo,
          section_path: section.sectionPath,
          original_text_zh: passage.originalTextZh,
          normalized_text_zh: passage.normalizedTextZh,
          script_type: passage.scriptType,
          provenance_hash: passage.provenanceHash,
          source_line_ref: passage.sourceLineRef,
          license_label: licenseLabel,
          verification_status: 'provisional',
          is_suspect: false,
          suspect_reason: null,
        },
      };
    });

    const passageResult = await upsertPassages(
      supabase,
      passageInputs.map((input) => input.row),
      replace ? [] : existingPassages
    );
    const tagCount = await upsertPassageConceptTags({
      supabase,
      passageInputs,
      passageIdBySectionAndNo: passageResult.passageIdBySectionAndNo,
    });
    const recordsWritten = collected.sections.length + passageResult.written + tagCount;

    await finishIngestRun({
      supabase,
      ingestRunId: ingestRun.ingest_run_id,
      status: 'success',
      recordsWritten,
      errorCount: 0,
      logExcerpt: buildLogExcerpt(collected),
    });

    return {
      workVersionId: workVersion.work_version_id,
      recordsWritten,
      sectionsWritten: collected.sections.length,
      passagesWritten: passageResult.written,
      conceptTagsWritten: tagCount,
      ingestRunId: ingestRun.ingest_run_id,
    };
  } catch (error) {
    await finishIngestRun({
      supabase,
      ingestRunId: ingestRun.ingest_run_id,
      status: 'failed',
      recordsWritten: 0,
      errorCount: 1,
      logExcerpt: error instanceof Error ? error.message : 'Unknown classics ingest failure.',
    });
    throw error;
  }
}

async function loadWorkVersion(supabase, sourceWorkRef) {
  const { data, error } = await supabase
    .from('classic_work_versions')
    .select('work_version_id, source_id, source_work_ref, license_override, verification_status, public_release_status, is_reference_only')
    .eq('source_work_ref', sourceWorkRef)
    .single();

  if (error) {
    throw new Error(`Could not load classic_work_versions row for ${sourceWorkRef}: ${error.message}`);
  }

  if (data.public_release_status !== 'live' || data.is_reference_only
      || !['reviewed', 'provisional'].includes(data.verification_status)) {
    throw new Error(`Refusing ingest for non-public or unverified work version ${sourceWorkRef}.`);
  }
  return data;
}

async function loadExistingPassages(supabase, workVersionId) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('classic_passages')
      .select('passage_id, section_id, passage_no, original_text_zh, classic_sections!inner(section_key)')
      .eq('work_version_id', workVersionId).order('passage_id').range(from, from + 999);
    if (error) throw new Error(`Could not check existing source text: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

export function assertUnchangedPassages(passages, existing) {
  const previous = new Map(existing.map((row) => [
    `${row.classic_sections.section_key}:${row.passage_no}`, row.original_text_zh,
  ]));
  for (const passage of passages) {
    const oldText = previous.get(`${passage.sectionKey}:${passage.passageNo}`);
    if (oldText !== undefined && oldText !== passage.originalTextZh) {
      throw new Error('Source text changed at an existing passage. Use a new work version or review a protected --replace before updating derived text.');
    }
  }
}

async function loadEffectiveLicenseLabel(supabase, workVersion) {
  if (workVersion.license_override) return workVersion.license_override;

  const { data, error } = await supabase
    .from('classic_sources')
    .select('license_label')
    .eq('source_id', workVersion.source_id)
    .single();

  if (error) {
    throw new Error(`Could not load license label for source ${workVersion.source_id}: ${error.message}`);
  }

  if (!data.license_label) {
    throw new Error(`Missing license label for source ${workVersion.source_id}`);
  }

  return data.license_label;
}

async function startIngestRun({ supabase, sourceId, workVersionId, jobName }) {
  const { data, error } = await supabase
    .from('classic_ingest_runs')
    .insert({
      source_id: sourceId,
      work_version_id: workVersionId,
      job_name: jobName,
      run_status: 'running',
    })
    .select('ingest_run_id')
    .single();

  if (error) {
    throw new Error(`Could not start classic_ingest_runs row: ${error.message}`);
  }

  return data;
}

async function finishIngestRun({
  supabase,
  ingestRunId,
  status,
  recordsWritten,
  errorCount,
  logExcerpt,
}) {
  const { error } = await supabase
    .from('classic_ingest_runs')
    .update({
      run_status: status,
      ended_at: new Date().toISOString(),
      records_written: recordsWritten,
      error_count: errorCount,
      log_excerpt: logExcerpt.slice(0, 4000),
    })
    .eq('ingest_run_id', ingestRunId);

  if (error) {
    throw new Error(`Could not finish classic_ingest_runs row: ${error.message}`);
  }
}

async function assertNoReviewedDerivedRows(supabase, workVersionId) {
  const passageIds = await loadPassageIdsForWorkVersion(supabase, workVersionId);
  let readingCount = 0;
  let translationCount = 0;
  const { count: versionCommentaries, error: commentaryError } = await supabase
    .from('classic_commentaries').select('commentary_id', { count: 'exact', head: true })
    .eq('work_version_id', workVersionId).in('review_status', ['reviewed', 'approved']);
  if (commentaryError) throw new Error(`Could not protect reviewed commentaries: ${commentaryError.message}`);
  if (versionCommentaries) throw new Error('Refusing --replace because reviewed/approved commentaries exist.');
  const { count: protectedOriginals, error: originalError } = await supabase
    .from('classic_passages').select('passage_id', { count: 'exact', head: true })
    .eq('work_version_id', workVersionId).or('verification_status.eq.reviewed,is_suspect.eq.true');
  if (originalError) throw new Error(`Could not protect original review decisions: ${originalError.message}`);
  if (protectedOriginals) throw new Error('Refusing --replace because reviewed or suspect original passages exist.');
  for (let from = 0; ; from += 1000) {
    const { data: sections, error: sectionError } = await supabase.from('classic_sections')
      .select('section_id').eq('work_version_id', workVersionId)
      .order('section_id').range(from, from + 999);
    if (sectionError) throw new Error(`Could not protect section commentaries: ${sectionError.message}`);
    for (const batch of chunk(sections ?? [], 100)) {
      const { count, error } = await supabase.from('classic_commentaries')
        .select('commentary_id', { count: 'exact', head: true })
        .in('section_id', batch.map((row) => row.section_id))
        .in('review_status', ['reviewed', 'approved']);
      if (error) throw new Error(`Could not protect section commentaries: ${error.message}`);
      if (count) throw new Error('Refusing --replace because reviewed/approved section commentaries exist.');
    }
    if (!sections || sections.length < 1000) break;
  }

  for (const batch of chunk(passageIds, 100)) {
    const { count: commentaryCount, error: passageCommentaryError } = await supabase
      .from('classic_commentaries').select('commentary_id', { count: 'exact', head: true })
      .in('passage_id', batch).in('review_status', ['reviewed', 'approved']);
    if (passageCommentaryError) throw new Error(`Could not protect passage commentaries: ${passageCommentaryError.message}`);
    if (commentaryCount) throw new Error('Refusing --replace because reviewed/approved commentaries exist.');
    const { count: manualTags, error: tagError } = await supabase
      .from('classic_passage_concept_tags').select('passage_id', { count: 'exact', head: true })
      .in('passage_id', batch).neq('tagging_source', 'wikisource_exact_keyword');
    if (tagError) throw new Error(`Could not protect reviewed concept tags: ${tagError.message}`);
    if (manualTags) throw new Error('Refusing --replace because non-generated concept tags exist.');
    const { count: batchReadingCount, error: readingError } = await supabase
      .from('classic_readings_ko')
      .select('reading_id', { count: 'exact', head: true })
      .in('passage_id', batch)
      .in('review_status', ['reviewed', 'approved']);

    if (readingError) {
      throw new Error(`Could not check reviewed readings before replace: ${readingError.message}`);
    }

    const { count: batchTranslationCount, error: translationError } = await supabase
      .from('classic_translations_ko')
      .select('translation_id', { count: 'exact', head: true })
      .in('passage_id', batch)
      .in('review_status', ['reviewed', 'approved']);

    if (translationError) {
      throw new Error(
        `Could not check reviewed translations before replace: ${translationError.message}`
      );
    }

    readingCount += batchReadingCount ?? 0;
    translationCount += batchTranslationCount ?? 0;
  }

  if ((readingCount ?? 0) > 0 || (translationCount ?? 0) > 0) {
    throw new Error(
      'Refusing --replace because reviewed/approved Korean derived rows already exist for this work version.'
    );
  }
}

async function loadPassageIdsForWorkVersion(supabase, workVersionId) {
  const passageIds = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('classic_passages')
      .select('passage_id')
      .eq('work_version_id', workVersionId)
      .range(from, from + 999);

    if (error) {
      throw new Error(`Could not load passages before replace: ${error.message}`);
    }

    passageIds.push(...(data ?? []).map((row) => row.passage_id));
    if (!data || data.length < 1000) break;
    from += 1000;
  }

  return passageIds;
}

async function deleteExistingPassages(supabase, workVersionId) {
  const { error } = await supabase
    .from('classic_passages')
    .delete()
    .eq('work_version_id', workVersionId);

  if (error) {
    throw new Error(`Could not delete existing classic_passages rows: ${error.message}`);
  }
}

async function deleteExistingSections(supabase, workVersionId) {
  const { error } = await supabase
    .from('classic_sections')
    .delete()
    .eq('work_version_id', workVersionId);

  if (error) {
    throw new Error(`Could not delete existing classic_sections rows: ${error.message}`);
  }
}

async function upsertSections({ supabase, workVersionId, sections }) {
  const sectionIdByKey = new Map();
  const depths = [...new Set(sections.map((section) => section.depth))].sort((a, b) => a - b);

  for (const depth of depths) {
    const rows = sections
      .filter((section) => section.depth === depth)
      .map((section) => ({
        work_version_id: workVersionId,
        parent_section_id: section.parentSectionKey
          ? sectionIdByKey.get(section.parentSectionKey) ?? null
          : null,
        depth: section.depth,
        sort_order: section.sortOrder,
        section_no: section.sectionNo,
        section_key: section.sectionKey,
        section_title_zh: section.sectionTitleZh,
        section_path: section.sectionPath,
        source_section_ref: section.sourceSectionRef,
      }));

    for (const batch of chunk(rows, 250)) {
      const { data, error } = await supabase
        .from('classic_sections')
        .upsert(batch, {
          onConflict: 'work_version_id,section_key',
        })
        .select('section_id, section_key');

      if (error) {
        throw new Error(`Could not upsert classic_sections batch: ${error.message}`);
      }

      for (const row of data ?? []) {
        sectionIdByKey.set(row.section_key, row.section_id);
      }
    }
  }

  return sectionIdByKey;
}

async function upsertPassages(supabase, passageRows, existing) {
  let written = 0;
  const passageIdBySectionAndNo = new Map(existing.map((row) => [
    `${row.section_id}:${row.passage_no}`, row.passage_id,
  ]));
  // Unchanged source rows keep their provenance, review/suspect decisions and derivatives.
  const newRows = passageRows.filter((row) => !passageIdBySectionAndNo.has(`${row.section_id}:${row.passage_no}`));
  for (const batch of chunk(newRows, 250)) {
    const { data, error } = await supabase
      .from('classic_passages')
      .upsert(batch, {
        onConflict: 'section_id,passage_no',
        ignoreDuplicates: true,
      })
      .select('passage_id, section_id, passage_no');

    if (error) {
      throw new Error(`Could not upsert classic_passages batch: ${error.message}`);
    }

    for (const row of data ?? []) {
      passageIdBySectionAndNo.set(`${row.section_id}:${row.passage_no}`, row.passage_id);
    }

    written += batch.length;
  }

  return { written, passageIdBySectionAndNo };
}

async function upsertPassageConceptTags({
  supabase,
  passageInputs,
  passageIdBySectionAndNo,
}) {
  const conceptSlugs = [
    ...new Set(passageInputs.flatMap((input) => input.conceptSlugs).filter(Boolean)),
  ];

  if (conceptSlugs.length === 0) return 0;

  const { data: conceptRows, error: conceptError } = await supabase
    .from('classic_concept_tags')
    .select('concept_tag_id, concept_slug')
    .in('concept_slug', conceptSlugs);

  if (conceptError) {
    throw new Error(`Could not load classic_concept_tags: ${conceptError.message}`);
  }

  const conceptIdBySlug = new Map(
    (conceptRows ?? []).map((row) => [row.concept_slug, row.concept_tag_id])
  );
  const tagRows = [];

  for (const input of passageInputs) {
    const passageId = passageIdBySectionAndNo.get(
      `${input.row.section_id}:${input.row.passage_no}`
    );
    if (!passageId) continue;

    for (const conceptSlug of input.conceptSlugs) {
      const conceptTagId = conceptIdBySlug.get(conceptSlug);
      if (!conceptTagId) continue;

      tagRows.push({
        passage_id: passageId,
        concept_tag_id: conceptTagId,
        confidence: 0.72,
        tagging_source: 'wikisource_exact_keyword',
      });
    }
  }

  let written = 0;
  for (const batch of chunk(tagRows, 500)) {
    const { error } = await supabase.from('classic_passage_concept_tags').upsert(batch, {
      onConflict: 'passage_id,concept_tag_id',
      ignoreDuplicates: true,
    });

    if (error) {
      throw new Error(`Could not upsert classic_passage_concept_tags batch: ${error.message}`);
    }

    written += batch.length;
  }

  return written;
}

function buildLogExcerpt(collected) {
  const pageRefs = collected.pages
    .map((page) => `${page.requestedTitle}@oldid=${page.revisionId}`)
    .join(', ');
  const warningLine =
    collected.warnings.length > 0 ? ` warnings=${collected.warnings.join(' | ')}` : '';

  return `work=${collected.work.key} pages=${collected.pages.length} sections=${collected.sections.length} passages=${collected.passages.length} refs=${pageRefs}${warningLine}`;
}

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}
