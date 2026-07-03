# 풀이 공유 스냅샷 설계 — 궁합 공개 뷰 + 전체 풀이 공유 커버리지

> 2026-07-03. #584(공유 전수감사) 후속. 목표: "공유 링크를 받은 사람이 로그인 없이
> 보낸 사람이 본 결과를 그대로 본다"를 모든 풀이에서 성립시킨다.

## 1. 원칙

1. **수신자 재현성**: 공유 URL 만으로 동일 결과가 결정론적으로 렌더돼야 한다(로그인·계정 스코프 데이터 금지).
2. **개인 스코프 ID 비노출**: familyId·reading UUID(소유 계정 종속) 류를 공유 URL 에 싣지 않는다.
3. **유료 콘텐츠 비포함**: 공개 스냅샷은 무료 요약까지만. 유료 심층은 수신자 자신의 결제/멤버십으로만 열람(기존 게이트 재사용).
4. **검색 비노출**: 개인 생년 정보가 URL 에 담기므로 robots noindex(기존 saju share 페이지와 동일 선례).
5. **기존 패턴 재사용**: saju 의 `toSlug/fromSlug`(생년 입력 ↔ URL-safe slug, 해시 토큰 검증 포함)를 사람 단위로 재사용.

## 2. Part 1 — 궁합 공개 공유 스냅샷 `/compatibility/share/[slug]`

### slug 형식
```
{relationship}--{selfSlug}--{partnerSlug}
```
- `relationship`: `COMPATIBILITY_RELATIONSHIPS` slug (검증).
- `selfSlug`/`partnerSlug`: 기존 `toSlug(BirthInput)` 산출물. 단일 slug 는 `-` 단일 구분자로만 조립되고 각 part 는 non-empty 라 `--` 는 내부에 등장 불가 → 복합 구분자로 안전.
- 표시 이름: query `?a={selfName}&b={partnerName}` (선택, encodeURIComponent). 미제공 시 "나"/"상대". 이름을 경로가 아닌 query 로 분리해 slug 파서를 단순하게 유지.

### 신규 파일
- `src/lib/compatibility/share-slug.ts` (+ `.test.ts`)
  - `buildCompatibilityShareSlug(relationship, self: BirthInput, partner: BirthInput): string`
  - `parseCompatibilityShareSlug(slug): { relationship, self, partner } | null` — relationship 검증 + `fromSlug` 실패 시 null.
  - 순수 모듈(클라이언트 안전) — manual(직접입력) 결과 클라이언트에서도 사용.
- `src/app/compatibility/share/[slug]/page.tsx`
  - 공개 서버 페이지. parse 실패 → `notFound()`.
  - `buildCompatibilityInterpretation` 재계산 → **`CompatibilityResultView` 재사용**(결과 페이지와 동일한 무료 화면 + 유료 CTA. `hasLoveQuestionPurchase` 는 **수신자 본인**의 entitlement/멤버십으로 판정 — 로그인 수신자가 이미 구매자면 심층까지 열람).
  - birth 요약: `formatBirthSummary(BirthInput)`(saju-screen-helpers) 재사용.
  - 하단 CTA "우리 궁합도 보러가기" → `/compatibility/input?relationship=`.
  - 자체 ShareActions(재공유) — kakao path 도 같은 share URL.
  - metadata: `robots: { index: false, follow: false }`.

### 연결(발신측)
- `compatibility/result/page.tsx`(저장 프로필 분기): 공유 섹션의 url/kakao path 를 초대 랜딩 → **share slug URL** 로 교체(#584 임시안 대체).
- `manual-compatibility-result-client.tsx`: payload(selfBirthInput/partnerBirthInput/relationship/이름)로 동일 slug 생성 → ShareActions 추가(직접입력 궁합도 공유 가능해짐 — 기존엔 sessionStorage 라 공유 불가).

### 비범위(후속)
- LLM 심층 공유·스냅샷 DB 저장(현행 무료 해석은 결정론 재계산이라 저장 불필요).

## 3. Part 2 — 전체 풀이 공유 커버리지 매트릭스

| 풀이 | 결과 URL 성격 | 공유 버튼 | 수신자 재현 | 조치 |
|---|---|---|---|---|
| 사주 무료 결과 | 공개 slug(`fromSlug` 재계산) | ✓ `/saju/[slug]/share` | ✓ | 완료(#584 canonical 교정) |
| 궁합(저장 프로필) | 계정 스코프 → **공개 slug 신설** | ✓ | **✓ (Part 1)** | 이번 구현 |
| 궁합(직접입력) | sessionStorage(공유 불가) | ✗→✓ | **✓ (Part 1)** | 이번 구현 |
| 별자리 | 공개 정적+일별 시드 | ✓ | ✓ | 완료(#584 날짜 명시) |
| 띠운세 | 공개(period·birthYear 쿼리) | ✓ | ✓ | 완료(#584 birthYear 보존) |
| 타로 1장/3장 | 공개 결정론 쿼리 | ✓ | ✓ | 완료(#584 확정결과 재조립+shared 게이트) |
| **꿈해몽 상세** | 공개 SEO 페이지 | **✗ 없음** | ✓(공개) | **이번 구현(quick win)** — ShareActions 추가 |
| 오늘운세(무료 결과) | 개인화(입력 기반) → **공개 티저 신설** | ✗→✓ | **✓ (Part 3)** | **구현됨**: `/today-fortune/share/[slug]?d=&n=&c=` — free result 에 `shareSlug`(toSlug) 추가, 날짜 고정 재계산(무료 한줄+점수만, 유료 미포함). 구 sessionStorage payload 는 shareSlug 없어 버튼 미노출(다음 생성부터) |
| 오늘운세(유료 상세·스냅샷) | 유료+개인 | ✗ | ✗ | 정책상 비대상(무료 티저가 공유 대체) |
| 대운·택일·평생리포트 | 유료+개인 | ✗ | ✗ | **정책상 비대상**(유료 콘텐츠 공유=매출 훼손). 원하면 무료 티저 패턴 후속 |

**Part 2 이번 구현 범위**: 꿈해몽 상세 공유 버튼(공개 페이지라 slug 그대로 공유, 사전 요약을 카카오 description 으로).
**Part 2 후속**: 오늘운세 무료 티저 스냅샷 공개 뷰(설계만 기록 — 유료 게이트·개인정보 검토 필요).

## 4. 테스트
- share-slug 라운드트립(관계/시간미상/자시/커스텀좌표/음력? — toSlug 지원 범위 그대로), 변조 slug → null, relationship 화이트리스트.
- 게이트: typecheck·커스텀러너·vitest·금지문구 가드.
