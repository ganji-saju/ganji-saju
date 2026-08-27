// 2026-08-26 — 유입 referrer host 를 사람이 읽는 라벨로 묶는다. 사용자 질문:
//   "인포크링크로 유입된 거 어느 채널로 들어오는지 확인할 수 있나?"
//
//   ⚠️ 라벨은 **직전 한 단계**만 말한다. 인포크링크(링크인바이오)를 거쳐 들어오면 referrer 는
//   인포크링크이고, 그 위(인스타 프로필·카톡 등)는 브라우저가 넘겨주지 않는다 — 알 수 없다.
//   그래서 라벨을 '인스타그램'으로 뭉뚱그리지 않고 '인포크링크'라고 정직하게 적는다.
//   위 채널을 나누려면 인포크링크의 버튼별 URL 에 utm_source/campaign 을 다르게 붙여야 한다.
//
//   host 는 그룹 키로 접는다(같은 서비스가 여러 도메인을 쓰면 목록에서 흩어지기 때문).

export interface ReferrerGroup {
  /** 집계 키. 같은 서비스의 여러 도메인이 하나로 접힌다. */
  key: string;
  /** 화면 라벨. */
  label: string;
}

/** 앞에서부터 먼저 맞는 규칙이 이긴다 — 좁은 규칙을 위에 둔다. */
const RULES: ReadonlyArray<{ match: string; key: string; label: string }> = [
  // 링크인바이오(그 위 채널은 알 수 없다)
  { match: 'inpock', key: 'inpock', label: '인포크링크' },
  { match: 'linktr.ee', key: 'linktree', label: 'Linktree' },
  { match: 'litt.ly', key: 'littly', label: '리틀리' },
  { match: 'bio.link', key: 'biolink', label: 'bio.link' },
  { match: 'taplink', key: 'taplink', label: 'Taplink' },

  // 네이버는 표면별로 의미가 달라 쪼갠다(검색 유입과 블로그 유입은 다른 일이다).
  { match: 'blog.naver', key: 'naver-blog', label: '네이버 블로그' },
  { match: 'cafe.naver', key: 'naver-cafe', label: '네이버 카페' },
  { match: 'search.naver', key: 'naver-search', label: '네이버 검색' },
  { match: 'naver', key: 'naver', label: '네이버' },

  { match: 'instagram', key: 'instagram', label: '인스타그램' },
  { match: 'threads', key: 'threads', label: '스레드' },
  { match: 'facebook', key: 'facebook', label: '페이스북' },
  { match: 'kakao', key: 'kakao', label: '카카오' },
  { match: 'youtube', key: 'youtube', label: '유튜브' },
  { match: 'tiktok', key: 'tiktok', label: '틱톡' },
  { match: 'google', key: 'google', label: '구글' },
  { match: 'daum', key: 'daum', label: '다음' },
  { match: 'bing', key: 'bing', label: 'Bing' },
  { match: 'tistory', key: 'tistory', label: '티스토리' },
  { match: 't.co', key: 'x', label: 'X(트위터)' },
  { match: 'twitter', key: 'x', label: 'X(트위터)' },
  { match: 'x.com', key: 'x', label: 'X(트위터)' },
];

/** 롤업이 referrer 없음을 넣어두는 값. 라벨만 한글로 바꾼다. */
const DIRECT_KEYS = new Set(['(direct)', 'direct', '']);

export function resolveReferrerGroup(host: string): ReferrerGroup {
  const raw = (host ?? '').trim();
  const lower = raw.toLowerCase();

  if (DIRECT_KEYS.has(lower)) return { key: '(direct)', label: '직접 유입(referrer 없음)' };

  for (const rule of RULES) {
    if (lower.includes(rule.match)) return { key: rule.key, label: rule.label };
  }
  // 모르는 도메인은 손대지 않는다 — 억지 라벨보다 원본 host 가 정직하다.
  return { key: lower, label: raw };
}

/** host→방문자 수 맵을 그룹으로 접는다. 동률이면 키 오름차순(결정론). */
export function groupReferrers(
  entries: ReadonlyArray<{ host: string; visitors: number }>
): Array<{ key: string; label: string; visitors: number }> {
  const agg = new Map<string, { label: string; visitors: number }>();
  for (const entry of entries) {
    const group = resolveReferrerGroup(entry.host);
    const prev = agg.get(group.key);
    agg.set(group.key, {
      label: group.label,
      visitors: (prev?.visitors ?? 0) + Math.max(0, entry.visitors || 0),
    });
  }
  return Array.from(agg.entries())
    .map(([key, v]) => ({ key, label: v.label, visitors: v.visitors }))
    .sort((a, b) => (b.visitors - a.visitors) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}
