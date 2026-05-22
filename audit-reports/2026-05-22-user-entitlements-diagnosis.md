# `audit:user-entitlements` exit 1 진단 (2026-05-22)

> **방식**: read-only 진단 (코드 수정·리팩토링·DB 변경 없음).
> **트리거**: 2026-05-22 종합 검수 §7(Section 7)에서 범위 밖 5개 audit 스크립트 중 `audit-user-entitlements.mjs` 만 exit 1.

---

## 1. 실행 + 출력 캡처

- **명령** (검수 Section 7 / audit-task.md §9 와 동일하게 인자 없이):
  ```
  node scripts/audit-user-entitlements.mjs
  ```
- **exit code**: `1`
- **출력 전체** (단 1줄, stderr):
  ```
  사용법: node scripts/audit-user-entitlements.mjs <user-id-or-email>
  ```

## 2. exit 1 발생 단계·메시지

`scripts/audit-user-entitlements.mjs` `main()` 진입 직후 — **필수 CLI 인자 누락 가드**:

```js
// line 206-211
async function main() {
  const identifier = process.argv[2];
  if (!identifier) {
    console.error('사용법: node scripts/audit-user-entitlements.mjs <user-id-or-email>');
    process.exit(1);   // ← 여기서 종료
  }
  const supabase = createSupabaseServiceClient();  // line 213 — 인자 없으면 도달 못 함
  ...
```

- 두 번째 exit(line 283-288, `main().catch((err) => { console.error('❌ 오류:', …); process.exit(1); })`)는 **인자 통과 후 예외** 경로. 이번 실행은 출력에 `❌ 오류:` 가 없으므로 **arg-check(line 210)에서 종료** — catch 경로 미도달.

## 3. 코드/DB 영역 식별

- **영역**: 스크립트 자체의 **인자 파싱**(line 207). 프로덕션 코드/DB 로직과 무관.
- **스크립트 성격**(헤더 주석): 결제 진입점 9곳(PR #177/#178) production 검증용 **운영자 수동 진단 CLI**. 특정 유저의 `auth.users` / `subscriptions` / `product_entitlements` / `credit_transactions` 조회 + 9 진입점 예상 동작(차단/결제가능) 출력. 실행에 `.env.local` 의 `NEXT_PUBLIC_SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY` 필요(line 213).
- **다른 4개와 비교** (왜 이것만 exit 1):
  | 스크립트 | `process.argv[2]` 참조 | 인자 없이 |
  |------|------|------|
  | **audit-user-entitlements** | **1건 (필수)** | **exit 1 (usage)** |
  | audit-payment-idempotency | 0건 | exit 0 |
  | audit-business-activity | 0건 | exit 0 |
  | audit-lucky-hybrid | 0건 | exit 0 |
  | audit-ai-chat-idempotency | 0건 | exit 0 |

  → 나머지는 전체 스캔형(인자 불필요)이라 인자 없이 통과. user-entitlements 만 **per-user 인자 필수**.

## 4. git 이력 — #315 / score-factor 관련성

- `scripts/audit-user-entitlements.mjs` **최종 수정: 2026-05-16 `56fb41e` (#179 score-unification)** — 부수적 touch 1회.
- **#315(결제 동의 무한루프 fix) · score-factor 연동(#314/#315, 2026-05-21~22)과 무관.** 해당 작업은 이 스크립트를 건드리지 않음. arg-required 동작은 PR #177/#178 시점부터 존재.
- **결론**: exit 1은 최근 결제 작업의 회귀가 **아니라**, 검수가 이 스크립트를 **인자 없이 호출**한 방식 때문.

---

## 결론

**a) 실패 원인 (1줄)**
진단 스크립트가 필수 인자 `<user-id-or-email>` 없이 실행돼 usage 출력 후 `process.exit(1)` (line 207-210) — 설계상 정상 동작이며 **코드/DB 회귀가 아님**.

**b) 영향 범위**
**실 사용자 영향 0.** 프로덕션 코드/런타임/빌드와 무관한 **운영자 수동 진단 CLI**(`build`=`next build` 에 미체인). 결제·이용권 *로직 자체*의 이상 신호 아님 — 이 스크립트는 그 로직을 *조회*만 하며, 인자 없이는 조회조차 시작하지 않음. (실제 이용권 무결성은 인자를 주고 실행해야 검증 가능 — 미수행.)

**c) 권장 후속 조치**
- **코드 수정 불필요** — 스크립트는 의도대로 동작.
- **(사람 또는 Claude Code, ~5분) 문서·검수 절차 보정**: `audit-task.md` §9의 "범위 밖 5개 exit code 점검"에서 `audit-user-entitlements` 는 **인자 필수**임을 명시하고, ① 인자를 주고 실행하거나 ② 단순 exit-code 점검 대상에서 제외.
- **(선택, 사용자 직접) 실제 entitlement 무결성 확인**:
  ```
  node scripts/audit-user-entitlements.mjs <user-id-or-email>
  # 예: node scripts/audit-user-entitlements.mjs kym@richdoc.kr
  ```
  → `SUPABASE_SERVICE_ROLE_KEY`(민감 자격증명) + 실유저 PII 조회가 필요하므로 **사용자가 직접 실행 권장**(보안). 이번 진단은 자격증명 접근·DB 조회를 수행하지 않음.

---

> 진단 완료 — read-only. 소스 코드·DB 변경 없음. 이 스크립트의 exit 1 은 **검수 호출 방식(인자 누락)** 이슈이며, 결제·이용권 로직의 결함이 아님.
