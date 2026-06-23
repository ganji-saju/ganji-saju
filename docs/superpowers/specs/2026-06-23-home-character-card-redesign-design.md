# 설계 — 간지사주 메인화면 캐릭터 카드 개편

> 2026-06-23 · 입력: `20260623_ 간지사주 메인 수정.pptx`(slide3 시안) + 캐릭터 이미지 16종.
> 사용자 승인: A(카테고리 탭 제거)·B(카피·캐릭터 매핑 OK)·C(이미지 최적화 OK), "진행해줘".

---

## 1. 목표
메인 서비스 카드 영역을 시안(slide3)대로 **8개 캐릭터 일러스트 카드 그리드**로 교체.
각 카드 = 캐릭터 PNG(투명배경 한복 인물) + 메뉴명 + 후킹 카피 + "바로 확인하기".

## 2. 범위 (승인됨)
- **유지**: 시즌 배너(히어로) · MY 별자리 slot · 하단 CTA · AppShell/헤더.
- **교체**: 분리돼 있던 `무료 빠른 운세(2그리드)` + `서비스 카드 그리드` → **단일 8카드 그리드**.
- **제거**: 카테고리 탭(`GangiCategoryTabs` 사용 중단 — 8개뿐, 시안에도 없음).
- **신규 개발 0**: 8개 메뉴 라우트 전부 존재(`/saju·/daewoon·/taekil·/compatibility·/dream·/dialogue·/tarot·/today-fortune`).

## 3. 카드 구성 (시안 slide3 매핑)
순서·카피·캐릭터 = 시안 그대로. desc 를 후킹 카피로 교체.

| # | id | 메뉴명 | href | 카피 | 캐릭터(원본) | price 라벨 |
|---|---|---|---|---|---|---|
| 1 | saju | 사주 | /saju/new | 소름 돋는 내 운명 풀이 | 사주_ 백담 | 550원~ |
| 2 | daewoon | 대운 | /daewoon | 인생 바뀌는 운의 흐름 | 대운_존명 | 무료 |
| 3 | taekil | 택일 | /taekil | 성공하는 날은 따로 있다 | 상담_ | 무료 |
| 4 | gunghap | 궁합 | /compatibility/input | 우리, 진짜 맞는 인연일까? | 궁합_ 설화 | 990원 |
| 5 | dream | 꿈해몽 | /dream | 꿈이 알려주는 숨은 신호 | 꿈해몽_천녀 | 무료 |
| 6 | consult | 대화상담 | /dialogue | 말 못 할 고민, 속 시원히 | 상담 | 9,900원 |
| 7 | tarot | 무료타로 | /tarot/daily | 3장의 카드 선택 | 무료타로 | 무료 |
| 8 | today | 무료운세 | /today-fortune?concern=general | 오늘의 나의 운세는 | 무료운세 | 무료 |

> price 라벨은 기존 데이터 유지(시안엔 상담 9,900원만 명시 — naming/페이월 정합성은 기존값 신뢰).

## 4. 별자리·띠운세 처리 (시안에 없음 — 결정)
시안 8카드에서 빠진 `star-sign`·`zodiac` 카드:
- **그리드에서 제외**하되 **진입점 보존**(dead-anchor 가드 회귀 방지). 별자리는 상단 MY 별자리 slot 이 이미 진입 제공. 띠운세는 기존 `GANGI_FREE_HUB_ITEMS`(무료 허브) 또는 하단 보조 링크로 유지.
- 라우트(`/star-sign`·`/zodiac`)·데이터는 삭제하지 않음(다른 진입·SEO 유지).

## 5. 이미지 최적화 (필수 — 타로 cards-opt 패턴)
- 원본 16×~2MB PNG → 메인 모바일에 그대로 쓰면 16MB+ 로드(성능 재앙).
- **sharp 스크립트**로 카드용 변환: 투명배경 유지, 폭 ~640px(retina 카드), `avif`+`webp`+`png` 폴백. 카드별 1세트.
- 경로: `public/images/gangi/characters/{id}.{avif,webp,png}` (id = 위 표). 배너용은 `banner-hero.{avif,webp}`(선택).
- 변환본만 git 커밋(수 백 KB 예상). 원본 PNG·zip 은 비커밋(다운로드 폴더).
- 스크립트 `scripts/optimize-gangi-characters.mjs`(1회성, 멱등). 소스 경로는 인자/기본값.

## 6. 변경 파일
| 파일 | 변경 |
|---|---|
| `scripts/optimize-gangi-characters.mjs` | 신규 — sharp 변환(원본→avif/webp/png) |
| `public/images/gangi/characters/*` | 신규 — 최적화 캐릭터 8종 |
| `src/content/gangi-market.ts` | `GangiServiceCard`에 `image?`·`headline?` 추가 / `GANGI_HOME_CARDS` 8카드로 재구성(카피·이미지·순서) |
| `src/components/gangi/gangi-market.tsx` | `GangiServiceCardLink` — image 있으면 캐릭터 렌더(next/image `<Image>`) + "바로 확인하기" CTA. 무 image 는 기존 chip 폴백 |
| `src/features/home/gangi-home-client.tsx` | 카테고리 탭 제거, 무료액션 섹션 제거(8카드 통합), 띠운세 보조 링크 |

## 7. 검증
- next/image 라 raw `<img>` 0 (a11y 가드 정합). alt = 메뉴명.
- `npm run build`(이미지 import·CSS) · typecheck · `npm test`(933) · `audit:dead-anchors:strict`(별자리/띠운세 링크 보존) · `audit:redesign-coverage` · `audit:mockup-placeholders`.
- 렌더 검증: dev 서버 + 메인 스크린샷(모바일390/데스크톱1280)으로 카드 그리드 시각 확인.

## 8. 리스크
- 이미지 용량/로딩: 변환·`<Image>` lazy + sizes 로 완화.
- 투명배경 인물 사진의 카드 내 배치(상단 정렬·배경 그라데이션) — 시각 QA 필요.
- '택일' 캐릭터가 상담_ 재활용(시안) — 어색하면 후속 교체.
- price 라벨 정합성(기존 페이월과): 기존값 유지로 회귀 0.
