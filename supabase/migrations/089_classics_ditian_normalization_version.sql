-- Add a corrected import version, not a different classic or an expert-reviewed
-- edition. The first import omitted color-wrapped verses. Preserve its rows and
-- all derived text; this migration never deletes or retires existing data.
INSERT INTO public.classic_work_versions (
  work_id, source_id, source_work_ref, source_url, source_item_title,
  edition_name, edition_type, script_type, language_code, completeness_status,
  verification_status, public_release_status, license_override,
  is_primary_source, is_reference_only, source_last_verified_at, notes
)
SELECT
  work_id, source_id, 'title=滴天髓&normalizer=2', source_url, source_item_title,
  'Wikisource (normalizer v2)', edition_type, script_type, language_code, completeness_status,
  'provisional', 'live', license_override,
  is_primary_source, FALSE, source_last_verified_at,
  'Corrected normalization preserves color/+ verses with adjacent commentary. This is an import version, not a new book or expert review. Retain title=滴天髓 privately only after the new import and evidence checks succeed.'
FROM public.classic_work_versions
WHERE source_work_ref = 'title=滴天髓'
  AND source_id = (SELECT source_id FROM public.classic_sources WHERE source_code = 'zh_wikisource')
ON CONFLICT (source_id, source_work_ref) DO NOTHING;
