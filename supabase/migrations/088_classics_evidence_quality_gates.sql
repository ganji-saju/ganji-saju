-- Keep the evidence RPC's result contract while separating source text review
-- from review of Korean translations/commentaries. Provisional source text is
-- allowed; an unreviewed Korean summary must never masquerade as a translation.
CREATE OR REPLACE VIEW public.v_classic_evidence_flat
WITH (security_invoker = true) AS
SELECT
  w.canonical_slug,
  w.canonical_title_zh_hant,
  COALESCE(w.canonical_title_ko, w.canonical_title_zh_hant) AS canonical_title_ko,
  wv.work_version_id,
  wv.source_item_title,
  wv.edition_name,
  wv.edition_type,
  p.verification_status,
  wv.public_release_status,
  s.section_id,
  p.section_path,
  s.section_title_zh,
  COALESCE(s.section_title_ko, s.section_title_zh) AS section_title_ko,
  p.passage_id,
  p.passage_no,
  p.original_text_zh,
  rk.reading_ko,
  tl.translation_ko AS literal_translation_ko,
  ck.commentary_ko,
  src.source_name,
  src.source_type,
  wv.source_url,
  wv.source_work_ref,
  p.license_label AS effective_license_label
FROM public.classic_works w
JOIN public.classic_work_versions wv ON wv.work_id = w.work_id
JOIN public.classic_sources src ON src.source_id = wv.source_id
JOIN public.classic_sections s ON s.work_version_id = wv.work_version_id
JOIN public.classic_passages p
  ON p.section_id = s.section_id AND p.work_version_id = wv.work_version_id
LEFT JOIN public.classic_readings_ko rk
  ON rk.passage_id = p.passage_id
 AND rk.reading_system = 'hangul_hanja'
 AND rk.review_status IN ('reviewed', 'approved')
LEFT JOIN public.classic_translations_ko tl
  ON tl.passage_id = p.passage_id
 AND tl.translation_type = 'literal'
 AND tl.review_status IN ('reviewed', 'approved')
LEFT JOIN LATERAL (
  SELECT c.commentary_ko
  FROM public.classic_commentaries c
  WHERE c.passage_id = p.passage_id
    AND c.review_status IN ('reviewed', 'approved')
  ORDER BY (c.review_status = 'approved') DESC,
    c.reviewed_at DESC NULLS LAST, c.commentary_id
  LIMIT 1
) ck ON TRUE
WHERE wv.public_release_status = 'live'
  AND wv.verification_status IN ('reviewed', 'provisional')
  AND wv.is_reference_only = FALSE
  AND p.verification_status IN ('reviewed', 'provisional')
  AND p.is_suspect = FALSE
  AND NULLIF(BTRIM(wv.source_url), '') IS NOT NULL
  AND NULLIF(BTRIM(wv.source_work_ref), '') IS NOT NULL
  AND NULLIF(BTRIM(p.original_text_zh), '') IS NOT NULL
  AND NULLIF(BTRIM(p.section_path), '') IS NOT NULL
  AND NULLIF(BTRIM(p.source_line_ref), '') IS NOT NULL
  AND NULLIF(BTRIM(p.provenance_hash), '') IS NOT NULL
  AND NULLIF(BTRIM(p.license_label), '') IS NOT NULL;

REVOKE SELECT ON public.v_classic_evidence_flat FROM anon, authenticated;
