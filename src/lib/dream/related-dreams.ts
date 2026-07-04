// 2026-07-05 SEO — 꿈해몽 상세 페이지 "다른 꿈도 보기" 관련 링크 선택 로직.
//   목표: 페이지당 내부 링크 수를 늘리고(내부 링크 확충), 링크 대상을 전 항목에
//   고루 분산해 모든 꿈 페이지가 유입 링크를 받도록(강연결 그래프) 한다.
//
//   전략: (1) 손수 큐레이션한 relatedSlugs 를 먼저(의미적 관련성 우선),
//        (2) 부족분은 현재 slug 인덱스 기준 결정론적 회전 이웃(index+1, +2, …)으로 채운다.
//   결정론적이라 빌드마다 동일 — 정적 생성(generateStaticParams)과 정합.

/**
 * 관련 꿈 slug 목록 산출(순수·결정론). 반환 길이는 최대 count.
 *
 * @param allSlugs  전체 꿈 slug(DREAM_ENTRIES 순서 — 회전 이웃 기준축).
 * @param currentSlug  현재 페이지 slug(결과에서 항상 제외).
 * @param curated  손수 지정한 관련 slug(우선 배치, 유효/비중복만).
 * @param count  목표 개수(기본 6 — 3열 그리드 2줄).
 */
export function buildRelatedDreamSlugs(
  allSlugs: ReadonlyArray<string>,
  currentSlug: string,
  curated: ReadonlyArray<string> = [],
  count = 6
): string[] {
  const valid = new Set(allSlugs);
  const seen = new Set<string>([currentSlug]);
  const result: string[] = [];

  // 1) 큐레이션 우선(유효 + self/중복 제외, 순서 유지).
  for (const slug of curated) {
    if (result.length >= count) break;
    if (valid.has(slug) && !seen.has(slug)) {
      result.push(slug);
      seen.add(slug);
    }
  }

  // 2) 부족분은 결정론적 회전 이웃으로 채움 — 모든 항목이 링크 그래프에서 강연결이 되도록.
  const idx = allSlugs.indexOf(currentSlug);
  if (idx !== -1) {
    for (let step = 1; step < allSlugs.length && result.length < count; step += 1) {
      const slug = allSlugs[(idx + step) % allSlugs.length];
      if (!seen.has(slug)) {
        result.push(slug);
        seen.add(slug);
      }
    }
  }

  return result;
}
