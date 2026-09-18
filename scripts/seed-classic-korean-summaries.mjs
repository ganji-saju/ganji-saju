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

const CONCEPT_PRIORITY = [
  'yongsin',
  'johhu',
  'gyeokguk',
  'gangyak',
  'hapchung',
  'gongmang',
  'sinsal',
];

const CONCEPT_LABELS = {
  yongsin: '용신',
  johhu: '조후',
  gyeokguk: '격국',
  gangyak: '강약',
  hapchung: '합충',
  gongmang: '공망',
  sinsal: '신살',
};

const GENERATED_NOTE =
  'Exact-keyword Korean UI summary seed. Requires human review before approval.';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  loadLocalEnv(projectRoot);
  const supabase = createSupabaseServiceClient();

  const workVersions = await loadTargetWorkVersions(supabase);
  const passages = await loadTargetPassages(
    supabase,
    workVersions.map((workVersion) => workVersion.work_version_id)
  );
  const conceptTags = await loadConceptTags(supabase);
  const tagRows = await loadPassageConceptTags(
    supabase,
    passages.map((passage) => passage.passage_id)
  );

  const conceptSlugById = new Map(
    conceptTags.map((tag) => [tag.concept_tag_id, tag.concept_slug])
  );
  const conceptSlugsByPassageId = new Map();
  for (const tagRow of tagRows) {
    const conceptSlug = conceptSlugById.get(tagRow.concept_tag_id);
    if (!conceptSlug) continue;

    const values = conceptSlugsByPassageId.get(tagRow.passage_id) ?? [];
    values.push(conceptSlug);
    conceptSlugsByPassageId.set(tagRow.passage_id, values);
  }

  const summaryInputs = passages
    .map((passage) => ({
      passage,
      conceptSlugs: sortConceptSlugs(conceptSlugsByPassageId.get(passage.passage_id) ?? []),
    }))
    .filter((input) => input.conceptSlugs.length > 0)
    .map((input) => ({
      ...input,
      commentaryKo: buildKoreanSummary(input),
    }));

  const existing = await loadExistingUiSummaries(
    supabase,
    summaryInputs.map((input) => input.passage.passage_id)
  );
  const existingByPassageId = new Map(
    existing.map((commentary) => [commentary.passage_id, commentary])
  );

  const inserts = [];
  const updates = [];
  let skippedReviewed = 0;

  for (const input of summaryInputs) {
    const existingCommentary = existingByPassageId.get(input.passage.passage_id);

    if (!existingCommentary) {
      inserts.push(toInsertRow(input));
      continue;
    }

    if (['reviewed', 'approved'].includes(existingCommentary.review_status)) {
      skippedReviewed += 1;
      continue;
    }

    if (existingCommentary.commentary_ko !== input.commentaryKo) {
      updates.push({
        commentary_id: existingCommentary.commentary_id,
        commentary_ko: input.commentaryKo,
      });
    }
  }

  console.log(
    `Classic Korean summary seed mode=${args.apply ? 'apply' : 'dry-run'} candidates=${summaryInputs.length} inserts=${inserts.length} updates=${updates.length} skippedReviewed=${skippedReviewed}`
  );

  if (!args.apply) {
    for (const sample of summaryInputs.slice(0, 5)) {
      console.log(
        `  ${sample.passage.section_path} #${sample.passage.passage_no}: ${sample.commentaryKo}`
      );
    }
    return;
  }

  await insertCommentaries(supabase, inserts);
  await updateCommentaries(supabase, updates);
  console.log('Classic Korean summaries applied.');
}

function parseArgs(argv) {
  const args = {
    apply: false,
  };

  for (const arg of argv) {
    if (arg === '--apply') {
      args.apply = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

async function loadTargetWorkVersions(supabase) {
  const { data, error } = await supabase
    .from('classic_work_versions')
    .select('work_version_id, source_work_ref')
    .in('source_work_ref', EXPECTED_WIKISOURCE_REFS);

  if (error) {
    throw new Error(`Could not load target work versions: ${error.message}`);
  }

  if ((data ?? []).length !== EXPECTED_WIKISOURCE_REFS.length) {
    throw new Error('Not all first-pass Wikisource work versions exist.');
  }

  return data ?? [];
}

async function loadTargetPassages(supabase, workVersionIds) {
  const passages = [];
  for (const workVersionId of workVersionIds) {
    passages.push(
      ...(await loadAllRows(
        supabase,
        'classic_passages',
        'passage_id, work_version_id, section_id, section_path, passage_no, original_text_zh, verification_status',
        { column: 'work_version_id', value: workVersionId }
      ))
    );
  }
  return passages;
}

async function loadConceptTags(supabase) {
  return loadAllRows(supabase, 'classic_concept_tags', 'concept_tag_id, concept_slug');
}

async function loadPassageConceptTags(supabase, passageIds) {
  const rows = [];
  for (const batch of chunk(passageIds, 100)) {
    const { data, error } = await supabase
      .from('classic_passage_concept_tags')
      .select('passage_id, concept_tag_id')
      .in('passage_id', batch);

    if (error) {
      throw new Error(`Could not load passage concept tags: ${error.message}`);
    }

    rows.push(...(data ?? []));
  }
  return rows;
}

async function loadExistingUiSummaries(supabase, passageIds) {
  const rows = [];
  for (const batch of chunk(passageIds, 100)) {
    const { data, error } = await supabase
      .from('classic_commentaries')
      .select('commentary_id, passage_id, commentary_ko, review_status')
      .eq('commentary_type', 'ui_summary')
      .in('passage_id', batch);

    if (error) {
      throw new Error(`Could not load existing UI summaries: ${error.message}`);
    }

    rows.push(...(data ?? []));
  }
  return rows;
}

function sortConceptSlugs(conceptSlugs) {
  return [...new Set(conceptSlugs)].sort(
    (left, right) => CONCEPT_PRIORITY.indexOf(left) - CONCEPT_PRIORITY.indexOf(right)
  );
}

function buildKoreanSummary({ passage, conceptSlugs }) {
  const primary = conceptSlugs[0];
  const text = passage.original_text_zh;

  if (primary === 'yongsin') {
    if (/格|大勢|大势|用神無取|用神无取|不可執其格|不可执其格/u.test(text)) {
      return '이 문단은 용신을 잡을 때 뚜렷한 격이 서지 않으면 큰 흐름과 대세를 먼저 보라는 근거입니다.';
    }
    return '이 문단은 명식의 균형을 볼 때 어떤 기운을 쓰고 덜어야 하는지 판단하는 용신 근거입니다.';
  }

  if (primary === 'johhu') {
    return '이 문단은 계절의 차고 더운 기운을 조절해 명식의 균형을 판단하는 조후 근거입니다.';
  }

  if (primary === 'gyeokguk') {
    return '이 문단은 월령과 십신의 짜임을 통해 명식의 기본 격을 세우는 근거입니다.';
  }

  if (primary === 'gangyak') {
    return '이 문단은 일간과 주변 오행의 왕쇠를 살펴 강약을 판단하는 근거입니다.';
  }

  if (primary === 'hapchung') {
    return '이 문단은 합과 충, 형의 작용을 통해 관계와 변화의 압력을 읽는 근거입니다.';
  }

  if (primary === 'gongmang') {
    return '이 문단은 공망처럼 비어 있거나 지연되는 기운을 보조 판단으로 다루는 근거입니다.';
  }

  if (primary === 'sinsal') {
    return '이 문단은 신살을 큰 구조 위에 보조 신호로 얹어 해석하는 근거입니다.';
  }

  const labels = conceptSlugs.map((slug) => CONCEPT_LABELS[slug] ?? slug).join(', ');
  return `이 문단은 ${labels} 판단과 연결되는 고전 근거입니다.`;
}

function toInsertRow({ passage, commentaryKo }) {
  return {
    work_version_id: passage.work_version_id,
    section_id: passage.section_id,
    passage_id: passage.passage_id,
    commentary_type: 'ui_summary',
    commentary_ko: commentaryKo,
    generated_by: 'hybrid',
    review_status: 'unreviewed',
    notes: GENERATED_NOTE,
  };
}

async function insertCommentaries(supabase, rows) {
  for (const batch of chunk(rows, 250)) {
    const { error } = await supabase.from('classic_commentaries').insert(batch);
    if (error) {
      throw new Error(`Could not insert Korean summaries: ${error.message}`);
    }
  }
}

async function updateCommentaries(supabase, rows) {
  for (const row of rows) {
    const { error } = await supabase
      .from('classic_commentaries')
      .update({
        commentary_ko: row.commentary_ko,
        notes: GENERATED_NOTE,
      })
      .eq('commentary_id', row.commentary_id);

    if (error) {
      throw new Error(`Could not update Korean summary ${row.commentary_id}: ${error.message}`);
    }
  }
}

async function loadAllRows(supabase, table, select, filter) {
  const rows = [];
  let from = 0;

  while (true) {
    let query = supabase.from(table).select(select).range(from, from + 999);
    if (filter) query = query.eq(filter.column, filter.value);

    const { data, error } = await query;
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
