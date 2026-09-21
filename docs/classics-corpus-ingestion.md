# Classics corpus ingestion

This app now has the first production-oriented slice for classical saju evidence:

- Vendor input: `external/saju_corpus_package/`
- Migration: `supabase/migrations/006_classics_corpus.sql`
- Evidence route: `GET /api/classics/evidence?concept=용신`
- UI surface: saju result page, in the DB-backed `고전 원문 근거` panel

## Current scope

The first pass is metadata-first and offline-first. It creates tables for source, work, version, section, passage, Korean reading, Korean translation, commentary, concept tags, ingest runs, and validation runs. It also seeds source and version metadata from the provided manifest for the public-safe candidates:

- `滴天髓`
- `窮通寶鑑`
- `三命通會 (四庫全書本)`

No live scraping is part of this milestone.

## Applying the schema

Apply the Supabase migrations in order, including `006_classics_corpus.sql`.

The evidence route uses the `SUPABASE_SERVICE_ROLE_KEY` path because corpus reads are served through the app API, not directly from the browser. If the schema is not applied yet, the route returns a setup-required state instead of breaking the page.

## Passage ingestion sequence

This PR adds the first ingest CLI for the three public-safe Wikisource candidates.
The default mode is a dry run, so it collects and normalizes text without writing
to Supabase:

```bash
npm run ingest:classics -- --source=wikisource --dry-run
```

To collect one work only:

```bash
npm run ingest:classics -- --source=wikisource --work=ditian-sui --dry-run
```

Supported work keys:

- `ditian-sui`
- `qiongtong-baojian`
- `sanming-tonghui-siku`

After confirming dry-run counts, apply to Supabase with the service-role key from
`.env.local`:

```bash
npm run ingest:classics -- --source=wikisource --work=all --apply
```

For a corrected source import, use a new `classic_work_versions` row rather than
replacing production passages. Changed text at an existing section/passage
position is rejected by the importer, and unchanged rows retain their original
provenance and review decisions. Generated tags cannot overwrite existing tags.

Then validate corpus counts:

```bash
npm run validate:classics
```

### Corrected 적천수 normalization (2026-09-18)

The first normalizer discarded verses inside nested `color` / `+` formatting
templates. Version 2 preserves those verses, joins adjacent indented commentary
so applicability conditions stay with the quote, and removes `__TOC__` metadata.
This changes the import representation, not the book or its review level.

1. Back up the corpus tables and apply `089_classics_ditian_normalization_version.sql`.
   It only inserts `source_work_ref = 'title=滴天髓&normalizer=2'` from the existing
   Wikisource metadata. It does not modify or remove the original version.
2. Run `npm run ingest:classics -- --source=wikisource --work=ditian-sui --dry-run`
   and then the same command with `--apply`. The collector writes the new version
   while preserving the existing `title=滴天髓` passages and all derived rows.
3. Verify the new version's provenance and the three original anchors
   `財官印綬分偏正，兼論食傷格局定。`, `官煞相混來問我，有可有不可。`, and
   `傷官見官果難辨，可見不可見。`, including their following explanatory text.
4. Only after those checks succeed, retain the original version as
   `public_release_status = 'internal'`, `is_reference_only = true`. Preserve
   its verification status and rows. This catalog switch is reversible.
5. Run `npm run validate:classics`. Until the old version is private, the validator
   and `/verification` deliberately report attention to prevent duplicate public
   editions. The other eight held references remain blocked as before.

The `--replace` option is reserved for a separately authorized clean reload. Its
preflight rejects reviewed/suspect originals, reviewed/approved Korean readings,
translations or commentaries (including section-only rows), and non-generated
concept tags. It is not the refresh path above.

To add the first unreviewed Korean UI summaries for concept-tagged passages:

```bash
npm run seed:classics-summaries
npm run seed:classics-summaries -- --apply
npm run validate:classics -- --min-ui-summaries=1
```

The CLI uses the MediaWiki Action API `action=parse` result for `wikitext`,
`sections`, and `revid`. Each passage row stores source page and revision data in
`source_line_ref`, plus a `provenance_hash`. It also attaches low-confidence
`classic_passage_concept_tags` when an exact Chinese keyword maps to an existing
concept tag, so Korean queries such as `용신` can return initial original-text
evidence before translation and commentary layers are reviewed.

`classic_passages` must carry the audit/export snapshot directly on the passage
row:

- `work_version_id`
- `section_path`
- `passage_no`
- `original_text_zh`
- `source_line_ref`
- `provenance_hash`
- `license_label`
- `verification_status`

`license_label` is copied from the effective source/version license at ingest
time. For Wikisource rows this preserves the public-domain/CC BY-SA attribution
condition alongside the original passage text instead of relying only on joined
metadata.

1. Pick one `classic_work_versions` row whose `public_release_status` is `live` and whose `verification_status` is `provisional` or `reviewed`.
2. Load source text from approved local/offline material first. For the current Wikisource collector, use dry-run before applying and preserve page revision provenance.
3. Insert `classic_sections` with stable `section_key`, `section_path`, source references, and sort order.
4. Insert `classic_passages` with `section_path`, `original_text_zh`, optional `normalized_text_zh`, `source_line_ref`, `provenance_hash`, `license_label`, and `verification_status`.
5. Add `classic_readings_ko`, `classic_translations_ko`, and `classic_commentaries` only when their generation source and review state are explicit. The first Korean UI layer uses `classic_commentaries.commentary_type = 'ui_summary'`, `generated_by = 'hybrid'`, and `review_status = 'unreviewed'`.
6. Attach `classic_passage_concept_tags` for concepts such as `용신`, `조후`, `격국`, `강약`, `합충`, `공망`, and `신살`. The first Wikisource pass uses exact Chinese keyword tagging only; review-backed tags can overwrite or extend this later.
7. Record each batch in `classic_ingest_runs`.

## Provenance checklist

Every passage should preserve:

- Source name and URL through `classic_sources` and `classic_work_versions`
- Source work reference, edition name, edition type, completeness status, and verification status
- Source line or section reference when available
- License label or source-specific license override
- Suspect flags for OCR, missing sections, unclear source, or incomplete pages

## Release gates

Only expose passages through the evidence API when:

- `public_release_status = 'live'`
- `verification_status IN ('reviewed', 'provisional')`
- The source license/terms allow the intended display
- The passage has passage-level provenance

Keep these blocked or reference-only until manually reviewed:

- General `三命通會` Wikisource page with missing 권10-권12
- `淵海子平` Wikisource page marked unfinished/source-unclear
- `子平真詮` Wikisource redlink / missing base text
- `子平真詮評注` when it is being treated as if it were the base text
- CText OCR/community text as a standalone public source

Reference-only rows use `public_release_status = 'hold'` and
`is_reference_only = true`. They may exist in `classic_work_versions`, but
`search_classic_evidence` must never expose them. Apply or seed this catalog
state with:

```bash
npm run seed:classics-holds
npm run seed:classics-holds -- --apply
```

The evidence function is tag-gated: a passage must have a matching
`classic_passage_concept_tags` row for the requested concept before it can be
ranked. Text matches can improve rank, but they cannot make an untagged passage
visible.

## Verification

After ingesting passages, verify:

- `GET /api/classics/evidence?concept=용신` returns only live/reviewed or live/provisional rows.
- The saju result page renders original text, source reference, and license label.
- `npm run typecheck` still passes.
- Any ingest script logs a `classic_ingest_runs` row with record counts and errors.

`npm run validate:classics` also fails when:

- A passage is missing source/version/license/provenance fields.
- A `hold`/reference-only work version accidentally becomes live.
- The general incomplete `三命通會` page is live.
- The evidence API returns a non-live/unreviewed row.
- The evidence API returns a row that is not tagged with the requested concept.

## Merge map

The original recommended sequence was:

- PR #6: schema/API/UI base
- PR #7: Wikisource three-work ingest script and dry-run validation
- PR #8: Supabase dev DB load and evidence API verification
- PR #9: Korean UI summary layer and source/license display
- PR #10: production UI cleanup

After PR #10, the next maintenance slice is the public-hold catalog gate and
validator hardening in `008_classics_hold_metadata_and_tag_gated_evidence.sql`.
