# P0 Functional Repair Report

## Executive Summary

디자인 리팩터 이후 확인된 P0 기능 회귀 중 달빛 성향사주 결과/결제 handoff와 today-fortune 무료 결과 생성 안정성을 복구했다.

이번 수정은 기능 복구에 한정했다. 결제 시스템, DB schema, Supabase migration, 사주 계산, 성향 계산, 결과 생성 프롬프트는 변경하지 않았다.

## Fixed Scope

| 항목 | 결과 |
|---|---|
| `/saju/personality` 입력 후 무료 결과 생성 | 기존 sessionStorage handoff 유지 |
| `/saju/personality/result` 결과 표시 | 저장 리포트 scope 재조회 시 paid entitlement 반영 |
| 990원 깊이보기 결제 연결 | 기존 `/membership/checkout` + `saju_personality_mini` 유지 |
| 결제 성공 후 유료 결과 표시 | free row에도 entitlement가 있으면 paid result로 매핑 |
| 결제 실패/취소 후 무료 결과 복귀 | 기존 `payment=failed&scope=...` fallback 유지 |
| 기존 report 저장/재조회 | `saju_personality_reports` 재사용, migration 없음 |
| today-fortune 무료 결과 오류 | Supabase auth 조회 실패가 무료 생성 전체를 막지 않도록 방어 |

## Product Code Check

| 구분 | 값 |
|---|---|
| 성향사주 productCode | `saju_personality_mini` |
| 성향사주 packageId | `taste_saju_personality_mini` |
| 성향궁합 productCode | `personality_compatibility_mini` |
| 성향궁합 packageId | `taste_personality_compatibility_mini` |

`saju_personality_mini`와 `personality_compatibility_mini`는 payment catalog, scope resolver, checkout, success redirect에서 분리되어 있다.

## Payment / Entitlement Flow

1. 결과 화면 CTA는 `product=saju_personality_mini`, `scope=saju-personality:*`, `from=saju-personality-result`를 들고 `/membership/checkout`으로 이동한다.
2. checkout은 기존 `/api/payments/prepare`를 통해 로그인, 중복 구매, scope 유효성을 확인한다.
3. Toss 성공 후 `/membership/success`가 `/api/payments/confirm`을 호출한다.
4. confirm은 `grantTasteProductEntitlement`로 `product_entitlements` 권한을 부여한다.
5. success page는 `buildSajuPersonalityResultHref(scope)`로 `/saju/personality/result?paid=saju_personality_mini&scope=...`에 복귀한다.
6. result API는 free row라도 같은 scope에 entitlement가 있으면 paid access로 매핑한다.

## Result Route Handling

- `reportId`가 있으면 저장 리포트를 조회한다.
- `scope`가 있고 브라우저 임시 입력값이 없으면 저장 리포트를 scope로 조회한다.
- 입력값도 저장 리포트도 없으면 기존 missing state를 보여준다.
- 미구매자는 `productCode: free`로 응답하며 paid sections를 노출하지 않는다.
- 구매자는 `productCode: saju_personality_mini`로 응답하며 paid sections를 열 수 있다.

## Today Fortune Repair

today-fortune API에서 Supabase server env 또는 auth 조회가 실패해도 무료 결과 생성 자체가 실패하지 않도록 `userId`를 optional로 처리했다.

저장 가능한 환경에서는 기존처럼 `createReading`을 시도하고, 실패하면 기존 fallback인 `toSlug(parsed.input)` 기반 sourceSessionId를 사용한다.

## Files Changed

| 파일 | 변경 |
|---|---|
| `src/app/api/saju/personality/reports/route.ts` | free report row + paid entitlement 조합을 paid report로 매핑, 저장 시 paid sections 보존 |
| `src/features/saju-personality/saju-personality-result-builder.ts` | free snapshot에도 paid sections를 저장용으로 보존 |
| `src/app/api/today-fortune/route.ts` | Supabase auth 조회 실패 시 무료 결과 fallback 유지 |
| `src/lib/payments/product-scope.test.ts` | `saju_personality_mini` scope/redirect 테스트 추가 |
| `src/lib/payments/confirmation.test.ts` | `taste_saju_personality_mini` 결제 confirm validation 테스트 추가 |

## Validation Result

| 명령 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run typecheck` | 통과 |
| `npm test` | 통과 |
| `npm run build` | 통과 |
| `git diff --check` | 통과 |

## Browser Validation

in-app browser의 현재 탭은 `http://localhost:3000/login?...` 상태로 확인되었지만, `http://localhost:3000/today-fortune?concern=general` 이동은 브라우저 보안 정책에서 차단되었다.

정책 메시지가 localhost 사용을 금지하고 우회도 금지했기 때문에, 이번 보고서에서는 화면 상호작용 검증을 완료하지 않았다. Preview URL 또는 사용자의 직접 브라우저에서 smoke test가 필요하다.

## Not Modified

- 결제 confirm/prepare core 로직
- Toss SDK 호출 구조
- Supabase migration
- 사주 계산 엔진
- 성향 계산 엔진
- 성향궁합 2인 관계 로직
- 디자인/레이아웃 구조

## Remaining Risks

- 패치 이전에 이미 저장된 free report row는 `report_json.paidSections`가 비어 있을 수 있다. 같은 브라우저에 입력 sessionStorage가 남아 있으면 결제 후 paid row로 재저장되지만, 오래된 저장 row만 단독으로 재조회하면 paid section 본문이 없을 수 있다.
- 실제 Toss 결제창 오픈과 성공 redirect는 운영/sandbox Toss 환경에서 1건 smoke test가 필요하다.
- in-app browser가 localhost 검증을 차단하는 경우 화면 기반 자동 검증은 별도 preview URL에서 수행해야 한다.

## Go / No-Go

자동 검수 통과 후 P0 기능 복구 PR로 진행 가능하다. 운영 배포 전에는 preview 또는 production-like 환경에서 실제 로그인 사용자 기준으로 다음 smoke test를 수행해야 한다.

1. `/saju/personality` 무료 결과 생성
2. `/saju/personality/result` 결과 표시
3. 990원 checkout 진입
4. 결제 실패/취소 시 무료 결과 복귀
5. 결제 성공 후 `paid=saju_personality_mini&scope=...` 결과 유료 섹션 표시
6. `/today-fortune?concern=general` 무료 결과 생성
