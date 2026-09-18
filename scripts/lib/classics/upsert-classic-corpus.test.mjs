import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { upsertClassicWorkCorpus } from './upsert-classic-corpus.mjs';

const collected = {
  work: { key: 'test-work', sourceWorkRef: 'title=test' }, pages: [], warnings: [],
  sections: [{ sectionKey: 's1', depth: 1, sortOrder: 1, sectionPath: 'test / section' }],
  passages: [{ sectionKey: 's1', passageNo: 1, originalTextZh: '陰陽之道',
    provenanceHash: 'new-revision', sourceLineRef: 'page@oldid=2', conceptSlugs: ['gangyak'] }],
};

function corpusClient({ existing = [], reviewedCommentary = false, manualTag = false } = {}) {
  const writes = [];
  const client = { from(table) {
    let action = 'read'; let payload; let filters = []; let countOnly = false;
    const query = {
      select(_columns, options) { countOnly = options?.head ?? false; return this; },
      eq(key, value) { filters.push([key, value]); return this; },
      in(key, value) { filters.push([key, value]); return this; },
      neq() { return this; }, or() { return this; }, order() { return this; },
      range() { return this; }, single() { return this; },
      insert(value) { action = 'insert'; payload = value; return this; },
      update(value) { action = 'update'; payload = value; return this; },
      upsert(value, options) { action = 'upsert'; payload = value; this.options = options; return this; },
      delete() { action = 'delete'; return this; },
      then(resolve) {
        if (action !== 'read') writes.push({ table, action, payload, options: this.options });
        let data = []; let count = 0;
        if (table === 'classic_work_versions') data = { work_version_id: 'v1', source_id: 'src1',
          license_override: 'CC BY-SA 4.0', verification_status: 'provisional',
          public_release_status: 'live', is_reference_only: false };
        if (table === 'classic_ingest_runs') data = { ingest_run_id: 'run1' };
        if (table === 'classic_passages') data = existing;
        if (table === 'classic_sections') data = [{ section_id: 'sid1', section_key: 's1' }];
        if (table === 'classic_concept_tags') data = [{ concept_tag_id: 'tag1', concept_slug: 'gangyak' }];
        if (table === 'classic_commentaries' && reviewedCommentary && filters.some(([key]) => key === 'passage_id')) count = 1;
        if (table === 'classic_passage_concept_tags' && countOnly && manualTag) count = 1;
        return Promise.resolve({ data, count, error: null }).then(resolve);
      },
    };
    return query;
  } };
  return { client, writes };
}

const stored = { passage_id: 'p1', section_id: 'sid1', passage_no: 1,
  original_text_zh: '陰陽之道', classic_sections: { section_key: 's1' } };

test('changed source cannot overwrite an existing passage or detach its reviewed meaning', async () => {
  const { client, writes } = corpusClient({ existing: [{ ...stored, original_text_zh: 'old original' }] });
  await assert.rejects(upsertClassicWorkCorpus({ supabase: client, collected }), /Source text changed/);
  assert.equal(writes.some(({ table }) => table !== 'classic_ingest_runs'), false);
});

test('identical-source reingest preserves original review decisions and existing manual tags', async () => {
  const { client, writes } = corpusClient({ existing: [stored] });
  await upsertClassicWorkCorpus({ supabase: client, collected });
  assert.equal(writes.some(({ table }) => table === 'classic_passages'), false);
  assert.equal(writes.find(({ table }) => table === 'classic_passage_concept_tags').options.ignoreDuplicates, true);
});

test('replace protects reviewed passage commentary even when its work_version_id is absent', async () => {
  const { client, writes } = corpusClient({ existing: [stored], reviewedCommentary: true });
  await assert.rejects(upsertClassicWorkCorpus({ supabase: client, collected, replace: true }), /reviewed\/approved commentaries/);
  assert.equal(writes.some(({ action }) => action === 'delete'), false);
});

test('replace protects manual concept tags', async () => {
  const { client, writes } = corpusClient({ existing: [stored], manualTag: true });
  await assert.rejects(upsertClassicWorkCorpus({ supabase: client, collected, replace: true }), /non-generated concept tags/);
  assert.equal(writes.some(({ action }) => action === 'delete'), false);
});

test('CLI uses Next development env precedence and nonempty Supabase aliases', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'classic-env-test-'));
  try {
    writeFileSync(path.join(directory, '.env.local'), 'NEXT_PUBLIC_SUPABASE_URL=""\nSUPABASE_URL=https://wrong.invalid\n');
    writeFileSync(path.join(directory, '.env.development.local'), 'SUPABASE_URL=https://expected.invalid\nSUPABASE_SECRET_KEY=synthetic-test-key\n');
    const env = { ...process.env, NODE_ENV: 'development' };
    for (const key of Object.keys(env)) if (key.includes('SUPABASE') || key.startsWith('__NEXT_')) delete env[key];
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      import { loadLocalEnv, createSupabaseServiceClient } from ${JSON.stringify(new URL('./upsert-classic-corpus.mjs', import.meta.url).href)};
      loadLocalEnv(${JSON.stringify(directory)});
      assert.equal(createSupabaseServiceClient().supabaseUrl, 'https://expected.invalid');
    `], { env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
