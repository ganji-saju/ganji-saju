# SEO 콘텐츠 확장 계획

작성일: 2026-05-17 / 출처: audit Phase 1 + `src/app/sitemap.ts` + 카테고리 페이지 인벤토리

> Phase 10 에서 단계별 실행. 본 문서는 **확장 후보 우선순위** + **각 후보의 잠재 트래픽 / 작업 비용 / 위험** 정리.

---

## 1. 현 SEO 인프라 요약

| 항목 | 상태 |
|---|---|
| metadataBase | `getSiteUrl()` env 기반 — Phase 2 후 canonical `https://ganjisaju.kr` |
| sitemap.ts | 정적 라우트 + slug 동적 — `lastmod` 빌드 시점 동결 (P1) |
| robots.ts | disallow `/api/`, `/login`, `/saju/`, `/my`, `/admin` 등 — `/saju/` 차단 재검토 P1 |
| root metadata 키워드 | 6개 (사주/팔자/풀이/오행/운세/명리학) — 카테고리 부족 |
| slug 페이지 openGraph/twitter | 띠 12 + 별자리 12 + 꿈해몽 8 = 32 페이지 누락 P1 |
| title.template | `%s | 간지사주` → Phase 2 에서 `%s | 간지사주` 로 변경 |
| Vercel Analytics + Speed Insights | 활성 ✓ |

---

## 2. 확장 후보 — 우선순위

### 🥇 1순위 — 꿈해몽 사전 SEO 확장
- **현 상태**: `/dream-interpretation/[slug]` 8건 (`teeth-falling/snake-dream/water-dream/flying-dream/pregnancy-dream/money-dream/falling-dream/dead-relative-dream`) + `/dream` 검색 페이지
- **데이터 이원화**: `DREAM_ENTRIES` 8 vs `DREAM_DICTIONARY` 10+ — sitemap 엔 8건만
- **잠재 트래픽**: 한국어 꿈해몽 검색량 매우 큼 (월 100K+ 추정). long-tail 키워드 ("이빨 빠지는 꿈", "뱀꿈", "물에 빠지는 꿈", "임신꿈" 등) 다수
- **확장 안**:
  - `DREAM_DICTIONARY` 의 모든 항목을 `DREAM_ENTRIES` 로 통합
  - 100~500건 꿈 사전 추가 (외부 표준 사전 참고, 저작권 주의)
  - 한글 slug 도입: `/dream-interpretation/이빨-빠지는-꿈` 또는 ASCII slug + 한글 path alias
  - 각 page generateMetadata 에 keywords / openGraph 추가
- **작업 비용**: 데이터 큐레이션 = 중~대 (운영자 협업 필요). 코드 변경 = 소
- **위험**: 저작권 분쟁 가능성 (사전 본문 차용 시) → 자체 작성 필수

### 🥈 2순위 — 별자리 12×12 compat 매트릭스 SEO
- **현 상태**: `/star-sign/[slug]` 12 + `/star-sign/compat/[a]/[b]` 12×12=144
- **잠재 트래픽**: "양자리 황소자리 궁합", "물고기자리 처녀자리 궁합" 등 long-tail 12 \* 11 = 132 조합
- **확장 안**:
  - 144 페이지 모두 sitemap 등록 (현재 등록 여부 확인 필요)
  - generateMetadata 에 키워드 + openGraph 풍부화
  - 본문 콘텐츠를 단순 점수 → 상세 해설 카피 추가
- **작업 비용**: 콘텐츠 작성 = 중. 코드 = 소
- **위험**: 콘텐츠 중복 우려 → 12x12 별 차별화 카피 필요

### 🥉 3순위 — 띠운세 연/월/주간 정적 페이지
- **현 상태**: `/zodiac/[slug]` 12종 + query (today/week/month/year)
- **잠재 트래픽**: "쥐띠 2026 운세", "토끼띠 5월 운세" 등 시즌성 검색량 큼
- **확장 안**:
  - `/zodiac/[slug]/year/2026` 12 × N년 정적 페이지 생성
  - `/zodiac/[slug]/month/2026-05` 12 × 12개월 정적 페이지 생성
  - 매월 1일 cron 또는 ISR 로 신규 월 페이지 자동 생성
- **작업 비용**: 콘텐츠 양산 시스템 = 대. AI 카피 생성으로 보조 가능
- **위험**: 시즌 종료 후 stale 페이지 누적 — noindex 정책 결정 필요

### 4순위 — 타로 78카드 별 landing page
- **현 상태**: `/tarot/daily` 흐름만 존재. 78카드별 정적 페이지 0건
- **잠재 트래픽**: "타로 마법사 의미", "타로 죽음 카드 뜻" 등 검색량 중
- **확장 안**: `/tarot/cards/[name]` 78 정적 페이지 — 의미 + 정/역방향 해석 + 관련 카드
- **작업 비용**: 콘텐츠 작성 = 중. 코드 = 소
- **위험**: 사주 본업과 거리 — 우선순위 낮음

### 5순위 — root metadata 키워드 강화
- 현 6개 → 추가: 띠운세, 별자리, 꿈해몽, 타로, 궁합, AI 사주
- 카테고리별 metadata 도 동일하게 강화

---

## 3. P1 우선 보강 — slug 페이지 openGraph/twitter

```ts
// 예: src/app/zodiac/[slug]/page.tsx
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const zodiac = ZODIAC_DATA.find((z) => z.slug === slug);
  if (!zodiac) return {};
  return {
    title: `${zodiac.koreanName}띠 운세`,
    description: `${zodiac.koreanName}띠의 오늘/이번 주/이번 달 운세와 행운의 색깔, 추천 시간대.`,
    keywords: [`${zodiac.koreanName}띠 운세`, `${zodiac.koreanName}띠`, '띠운세', '2026 띠운세'],
    openGraph: {
      title: `${zodiac.koreanName}띠 운세 — 간지사주`,
      description: '...',
      images: [`/og/zodiac/${slug}.png`],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${zodiac.koreanName}띠 운세`,
    },
  };
}
```

대상 페이지 (32):
- `/zodiac/[slug]` × 12
- `/star-sign/[slug]` × 12
- `/dream-interpretation/[slug]` × 8

---

## 4. sitemap lastmod KST 동적화

- 현 `sitemap.ts` 의 `now = new Date()` → 빌드 시점 동결
- 안: daily 페이지는 cron 으로 daily lastmod 갱신 (Vercel cron + ISR revalidate)
- 또는 sitemap 자체를 dynamic route 로 변경 (요청 시점 KST dateKey 산출)

---

## 5. 작업 분해 (Phase 10)

| PR | 범위 |
|---|---|
| 10-A | 32 slug 페이지 generateMetadata 보강 (openGraph + twitter + keywords) |
| 10-B | sitemap lastmod 동적화 + canonical 도메인 정합 (Phase 2 의존) |
| 10-C | 꿈해몽 사전 100건 1차 (자체 작성) + 한글 slug 도입 |
| 10-D | 별자리 144 compat 페이지 콘텐츠 강화 + sitemap 등록 |
| 10-E (선택) | 띠운세 연/월간 정적 페이지 양산 시스템 |
| 10-F (선택) | 타로 78카드 landing page |

---

## 6. 측정 / KPI

- Vercel Analytics 활성 — 페이지뷰 / 진입 키워드 / 이탈률 추적
- Google Search Console 등록 + 사이트맵 제출 (운영자 입력 필요)
- 주요 KPI:
  - 카테고리별 organic search 진입 수
  - 신규 페이지 인덱싱 속도 (sitemap 등록 후 N일)
  - long-tail 키워드 노출 → CTR

---

## 7. 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-05-17 | 초기 작성 (Phase 1 audit) |
