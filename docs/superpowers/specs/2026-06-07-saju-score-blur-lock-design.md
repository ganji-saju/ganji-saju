# 사주 종합점수 블러-락 (단일 550원 언락) — 설계 스펙

- 날짜: 2026-06-07
- 상태: 설계 승인 대기(브레인스토밍 산출)
- 관련 이력: #311(점수 미리보기 등급만/`saju-score-gauge` preview, 현재 미사용) → #314·#315(현 `SajuScoreCard` + per-factor `LockGate` 550원×5)

## 1. 배경 / 동기
현재 `/saju/[slug]` 결과 화면은 **종합점수 숫자를 그대로 노출**하고, 그 아래 5요소(일주·격국·용신·오행·신살) 산출내역에 각각 작은 `🔒 자세히 →` 모달(`LockGate`, score-factor 550원/요소)을 단다. 사용자 피드백: **"점수 아래 자세히보기 클릭은 의미가 없다"** — 직관적이지 않고 전환에 약하다.

대신 **#311식 강(强)페이월**로 전환: 종합점수를 **블러 + 등급명만** 노출하고 **중앙에 단일 550원 결제 CTA**를 띄워, 한 번 결제로 **종합점수 + 5요소 내역 전체**를 공개한다.

## 2. 현재 상태 (코드 기준)
- `src/app/saju/[slug]/page.tsx:553-554`: `<SajuScoreCard score={sajuScore} />` + `<ScoreBreakdownCard score slug unlockedFactors={scoreFactorUnlocks} />`. `scoreFactorUnlocks = await getSajuScoreFactorEntitlements(slug)`(L349).
- `src/components/saju-score/`: `saju-score-card.tsx`(총점 원형 카운트업), `score-breakdown-card.tsx`(5요소 + per-factor `LockGate`), `lock-gate.tsx`(🔒 자세히 → 결제 모달, score-factor 550원), `saju-score-gauge.tsx`(#311 preview, **현재 미사용**), `ohaeng-bar-chart.tsx`.
- 가격 인프라: `src/lib/payments/catalog.ts`(`TasteProductId` union + `PAYMENT_PACKAGES`), `src/lib/saju/score-factor-access.ts`(`getTasteProductEntitlement(user,'score-factor',scopeKey)`), `src/app/membership/checkout/page.tsx`(taste product 제네릭 Toss 플로우 + `TASTE_PRODUCT_ZODIAC`/`TASTE_PRODUCT_GUIDE`), `src/lib/payments/product-scope.ts`(`buildReadingProductScopeKey(readingKey)`, `buildScoreFactorScopeKey`).

## 3. 목표 / 비목표
**목표**
- 종합점수+5요소 점수 블록을 **단일 550원 언락**(신규 `score-total`)으로 게이팅.
- 미해제: 블러 + 등급명 + 중앙 결제 CTA. 해제: 전체 노출.
- per-factor `LockGate`(🔒 자세히) UI 제거.
- 과거 구매자(점수 관련) 보호(grandfather).

**비목표(out of scope)**
- 라이프타임 리포트(49,000)·기타 taste product 변경 없음.
- 실제 Toss 결제 모듈 신규 구현 없음(기존 taste_product 결제·grant 경로 재사용).
- `오늘의 분야별 흐름`(today detail/분야별) 잠금은 무관(별도 `detail-unlock`).

## 4. 설계 (Approach A: `ScoreLockGate` 래퍼)

### 4.1 신규 상품 `score-total`
- `catalog.ts` `TasteProductId` union에 `'score-total'` 추가.
- `PAYMENT_PACKAGES`에 `taste_score_total` 추가: `{ id:'taste_score_total', name:'사주 점수 공개', credits:0, price:550, kind:'taste_product', tasteProductId:'score-total', requiresSlug:true }`.
- scope: per-reading 단일. `buildReadingProductScopeKey(readingKey)` 재사용(요소 단위 아님).

### 4.2 엔타이틀먼트 + grandfather
신규 `getScoreUnlockEntitlement(slug): Promise<boolean>` (위치: `score-factor-access.ts` 확장 또는 신규 `score-unlock-access.ts`).
- env/유저 없으면 `false`(방어적, 응답 안 막음 — 기존 패턴).
- `readingKey = toSlug(resolveReading(slug).input) ?? slug`.
- unlocked = **다음 중 하나라도 true**:
  1. `getTasteProductEntitlement(user,'score-total', buildReadingProductScopeKey(readingKey))`
  2. **grandfather**: `getSajuScoreFactorEntitlements(slug)`의 F1~F5 **전부 true**, 또는 today-set 번들 보유(기존 `bundle.ts` 경로).
- 페이지에서 `getSajuScoreFactorEntitlements` 호출을 `getScoreUnlockEntitlement`로 교체.

### 4.3 `ScoreLockGate` 컴포넌트 (신규, `components/saju-score/score-lock-gate.tsx`)
```
interface ScoreLockGateProps {
  isUnlocked: boolean;
  slug: string;
  gradeLabel: string;   // 잠금 시 노출할 등급명(예: '안정·양호')
  price?: string;       // 기본 '550원'
  children: ReactNode;  // SajuScoreCard + ScoreBreakdownCard
}
```
- `isUnlocked === true`: **`{children}` 그대로 렌더**(실제 `SajuScoreCard`+`ScoreBreakdownCard`).
- 잠금(`isUnlocked === false`): **children을 렌더하지 않는다.** 대신 게이트가 비민감 프리뷰를 직접 그린다:
  - 등급명(`gradeLabel`) + **장식용 블러 스켈레톤**(가짜 원형/막대 형태, 실제 숫자 없음) — `blur-[2px] select-none pointer-events-none`.
  - 위에 `relative z-20 ... bg-white/86 backdrop-blur-sm` 중앙 카드: 등급명 + "점수 공개" + `price` pill + CTA `<a>`.
  - CTA: `/membership/checkout?product=score-total&slug={encodeURIComponent(slug)}&from=saju-result`.
- ⚠️ **보안(필수, #311 교훈):** 잠금 상태에서 **총점·요소 숫자는 DOM(클라이언트 HTML)에 절대 포함되지 않는다.** 블러는 시각적 가림일 뿐이라 DOM에 값이 있으면 우회 가능 → 위처럼 **잠금 시 real children 미렌더 + 장식 스켈레톤만**으로 보장. 회귀 테스트로 잠금 HTML에 숫자 미포함 검증.
- **서버 컴포넌트**로 구현(CTA는 단순 `<a>` 링크 — client/모달 불필요). 이로써 잠금 분기 자체가 서버에서 결정되어 민감값이 번들에 실리지 않음.

### 4.4 페이지 배선 (`saju/[slug]/page.tsx`)
- `const scoreUnlocked = await getScoreUnlockEntitlement(slug);`
- 점수 블록을 래핑:
  ```
  <ScoreLockGate isUnlocked={scoreUnlocked} slug={slug} gradeLabel={sajuScore.label.title}>
    <SajuScoreCard score={sajuScore} />
    <ScoreBreakdownCard score={sajuScore} slug={slug} />
  </ScoreLockGate>
  ```
- `OhaengChart`는 잠금 범위 밖(현행 유지) — 단, 점수 맥락이면 포함 여부는 플랜에서 확정(기본: 밖).

### 4.5 per-factor 정리
- `ScoreBreakdownCard`에서 `LockGate`(per-factor 🔒 자세히) 제거 + `unlockedFactors`/`slug` prop 정리(해제 시 5요소 풀이 전체 노출). 잠금 자체는 상위 `ScoreLockGate`가 담당.
- `lock-gate.tsx`는 미사용화 → 제거 또는 deprecated 주석. (`saju-score/index.ts` export 정리.)
- `score-factor` 카탈로그/번들 항목은 **inert 유지**(grandfather 조회용). 신규 노출 없음.

### 4.6 체크아웃 맵
- `TASTE_PRODUCT_ZODIAC`에 `'score-total': 'dragon'` 추가.
- `TASTE_PRODUCT_GUIDE`에 `'score-total'` 추가: `{ title:'사주 점수 공개', price:'550원', reassurance:'종합점수와 5요소 산출 내역 전체를 한 번에 엽니다. 같은 결과는 다시 결제하지 않습니다.', nextRange:'종합점수·등급 + 일주·격국·용신·오행·신살 5요소 풀이가 모두 열립니다.', opens:['종합점수·등급 공개','5요소 산출 내역 전체','이미 구매한 결과 재열람'], notices:['점수 공개는 현재 사주 결과 단위로 연결됩니다.','다시 열 때는 구매 여부를 먼저 확인합니다.'] }`.
- 제네릭 taste_product Toss 결제·entitlement grant 경로 그대로 적용(신규 코드 없음). **검증 필요**: grant 경로가 임의 `tasteProductId`를 일반 처리하는지(플랜에서 확인).

## 5. 데이터 흐름
1. 결과 진입 → `getScoreUnlockEntitlement(slug)` → false면 잠금 렌더.
2. CTA → `/membership/checkout?product=score-total&slug&from=saju-result` → 기존 Toss taste_product 플로우.
3. 결제 성공 → `product_entitlements`에 `score-total`+`buildReadingProductScopeKey` grant.
4. 결과 재진입 → 엔타이틀먼트 true → 전체 노출.

## 6. 오류 처리 / 방어
- env/유저/Supabase 없음 → `false`(잠금) 반환, 응답 막지 않음(기존 access 패턴 준수).
- `resolveReading` 실패 → `slug`를 readingKey로 폴백.
- grandfather 조회 실패 → score-total 단독 판정으로 graceful degrade.

## 7. 테스트
- `score-unlock-access` 단위 테스트: (a) score-total 보유→unlocked, (b) F1~F5 전부 보유→grandfather unlocked, (c) 일부만→locked, (d) env 없음→locked.
- 회귀: 기존 saju-score/점수 테스트 통과(859 unit).
- 렌더 검증(가능 시): 잠금 시 총점 숫자가 HTML에 미포함(보안).
- 정적 가드: `score-total`이 catalog/checkout 맵에 일관 등록(누락 시 typecheck 또는 테스트로 포착).

## 8. 마이그레이션 / 호환
- 신규 `score-total` 게이트. 과거 score-factor/번들 구매자는 grandfather로 보호.
- `score-factor` SKU·`LockGate` 코드는 즉시 삭제하지 않고 inert(조회용) — 추후 별도 정리.

## 9. 영향 파일(예상)
- `src/lib/payments/catalog.ts` (union + package)
- `src/lib/saju/score-unlock-access.ts` (신규) 또는 `score-factor-access.ts` 확장
- `src/components/saju-score/score-lock-gate.tsx` (신규)
- `src/components/saju-score/score-breakdown-card.tsx` (LockGate 제거)
- `src/components/saju-score/index.ts` (export 정리)
- `src/app/saju/[slug]/page.tsx` (배선)
- `src/app/membership/checkout/page.tsx` (맵 2곳)
- 테스트 신규/회귀
