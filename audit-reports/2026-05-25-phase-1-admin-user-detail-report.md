# Phase 1 — Gap A: 어드민 사용자 상세 + 검색 구현 보고서

- 작성일: 2026-05-25
- 브랜치: `feat/phase-1-admin-user-detail` (origin/main `ad608ec` = Phase 0b 포함)
- 설계서: `docs/claude-specs/phase-1-admin-user-detail.md`
- 방법: 순수 로직 **TDD**(RED→GREEN), 데이터 레이어·페이지는 typecheck + 회귀

## 1. 변경 파일
| 구분 | 파일 |
|---|---|
| 신규 데이터 레이어 | `src/lib/admin/user-detail.ts` (+ `user-detail.test.ts`) |
| 신규 페이지 | `src/app/admin/users/page.tsx`(검색·목록), `src/app/admin/users/[id]/page.tsx`(상세 6섹션) |
| 수정 | `src/app/admin/operations/page.tsx`(관리자 메뉴에 "사용자 조회" 진입점 추가) |
| 신규 문서 | 설계서, 본 보고서 |

## 2. 동작
- `/admin/users?q=` — 이메일 부분일치(`auth.admin.listUsers` 첫 200명 내) 또는 UUID 정확일치(`getUserById`) → 결과 카드(클릭→상세).
- `/admin/users/[id]` — `getAdminUserDetail`로 6섹션 집계(service_role, own-row RLS 우회):
  1. 회원 정보 — `auth.users`(email/가입일) + `profiles`(이름·생년월일·성별)
  2. 사주 — 최신 `readings.result_json.pillars`에서 **팔자**(없으면 birth로 재계산) + 조회수
  3. 결제 — `product_entitlements` + `credit_transactions` → **`buildPaymentHistory` 재활용**(총액·건수·내역)
  4. AI챗 — `dialogue_messages` count
  5. LLM 통계 — `ai_llm_runs` WHERE `user_id_hash`=hash(id) → feature별 openai/cache/fallback/비용(**fallback>0 빨강**)
  6. 환불 가능 — 활성 `product_entitlements` amount>0(상태·paymentKey 유무 표시)
- 인증: 기존 `/admin/layout.tsx` 화이트리스트 가드 그대로(미인증→login, 비admin→홈). **마이그레이션 없음**.

## 3. 테스트
- 순수 로직 **TDD 4개**(RED→GREEN): `extractPalja`(8/6글자), `buildUserLlmStats`(source 카운트·비용합), `determineRefundEligibility`(amount>0·합계).
- `buildPaymentHistory`는 기존 테스트 보유(재활용).
- 전체 **718/718** · `npm run typecheck` **0**.

## 4. 검증 한계 (정직)
- ⚠️ **UI 라이브 검증 미수행**: admin 화이트리스트 세션 + Supabase service env + 실제 사용자 데이터가 있어야 페이지가 렌더됨 → 로컬 브라우저 확인 불가. 코드 정합은 typecheck + 단위테스트 + (CI) build로 검증.
- **권장 라이브 확인**: 머지 후 prod(또는 admin 로그인된 프리뷰)에서 `/admin/users`로 본인(kym@richdoc.kr) 검색 → 상세 6섹션 렌더 확인.

## 5. 주의 / 알아둘 점
- **LLM 통계는 Phase 0b 배포 이후 호출분만**(`ai_llm_runs` user_id_hash). 기존 사용자는 활동해야 누적 → 초기엔 비어 보일 수 있음(정상).
- **환불 = 상태 표시만**. 실제 Toss 결제취소는 **Phase 2**. paymentKey 유무로 Phase 2 가능 여부 미리 노출.
- **이메일 검색**은 `listUsers` 첫 200명 client 필터 — 대규모 시 개선 대상(설계서 결정 1).
- PII(이메일·생년월일·결제) 집약 화면 → admin 가드 필수(존재). AI챗은 **count만**(내용 미노출).

## 6. 비목표 (로드맵)
- 실제 환불 실행 → **Phase 2**. LLM 비용 *대시보드*(영역별 추세) → **Phase 3**. 사용자 데이터 수정(읽기 전용).
