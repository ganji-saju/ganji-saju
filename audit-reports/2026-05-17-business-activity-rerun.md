# Business Activity Audit — 2026-05-17 (분기 재실행 1회차)

PR #216 의 `scripts/audit-business-activity.mjs` 정기 재실행. PROGRESS.md §1.21 — "분기 1회 재산정으로 회귀 패턴 변화 모니터링" 가이드 이행.

- 실행: `npm run audit:business-activity` (last 30 days, since 2026-04-17)
- baseline: PR #216 body 의 표 (동일 30-day window, 같은 날 earlier snapshot)
- 결론: **우선순위 등급 변화 없음** — 단일 delta `reading_created` 221 → 226 (+5, +2.3%) 만 관측, 같은 TOP 등급 유지.

---

## 1. Snapshot (2026-05-17, last 30d, 9 unique users)

| 등급 | event / product | events | unique_users |
|---|---|---|---|
| 🔴 TOP | reading_created | 226 | 9 |
| 🔴 TOP | credit_deduct / detail_report (1코인) | 46 | 4 |
| 🔴 TOP | entitlement_purchased / today-detail (550원) | 35 | 7 |
| 🟡 MEDIUM | fortune_feedback / general | 24 | 4 |
| 🟡 MEDIUM | credit_deduct / ai_chat (3코인) | 22 | 3 |
| 🟡 MEDIUM | entitlement_purchased / lifetime-report (49,000원) | 8 | 4 |
| 🟡 MEDIUM | entitlement_purchased / monthly-calendar | 6 | 3 |
| 🟡 MEDIUM | entitlement_purchased / year-core | 5 | 3 |
| 🟢 LOW | entitlement_purchased / personality_compatibility_mini | 3 | 1 |
| 🟢 LOW | fortune_feedback / work_meeting | 3 | 3 |
| 🟢 LOW | entitlement_purchased / love-question | 2 | 2 |
| 🟢 LOW | credit_deduct / calendar | 1 | 1 |
| 🟢 LOW | entitlement_purchased / work-flow | 1 | 1 |
| 🟢 LOW | entitlement_purchased / money-pattern | 1 | 1 |
| 🟢 LOW | entitlement_purchased / saju_personality_mini | 1 | 1 |
| 🟢 LOW | appointment_booked | 1 | 1 |

---

## 2. PR #216 baseline 대비 변화

| event / product | baseline events | now events | Δ | 등급 변동 |
|---|---|---|---|---|
| reading_created | 221 | 226 | **+5** | 🔴 TOP 유지 |
| credit_deduct / detail_report | 46 | 46 | 0 | 🔴 TOP 유지 |
| entitlement_purchased / today-detail | 35 | 35 | 0 | 🔴 TOP 유지 |
| fortune_feedback / general | 24 | 24 | 0 | 🟡 MEDIUM 유지 |
| credit_deduct / ai_chat | 22 | 22 | 0 | 🟡 MEDIUM 유지 |
| entitlement_purchased / lifetime-report | 8 | 8 | 0 | 🟡 MEDIUM 유지 |
| entitlement_purchased / monthly-calendar | 5~6 | 6 | 0 | 🟡 MEDIUM 유지 |
| entitlement_purchased / year-core | 5~6 | 5 | 0 | 🟡 MEDIUM 유지 |
| 🟢 LOW 항목 합 | — | 14 events / 8 products | — | 🟢 LOW 유지 |

PR #216 baseline 본문에서 LOW 는 "love-question / money-pattern / work-flow / appointment / …" 로 압축 표기됐고, 본 snapshot 은 항목별 분해. 합계·우선순위는 동일.

---

## 3. 해석

- **사주 + today-fortune detail 핵심 흐름이 여전히 86%+ 차지** — reading_created 226 + detail_report 46 + today-detail 35 = 307 / 전체 386 = 79.5%. PR #216 baseline (302/360 = 84%) 와 유사하나 LOW 분해로 분모가 늘어남.
- **+5 reading_created** — PR #216 작성 후 본 재실행 사이의 신규 reading. trafic 활동 정상, 회귀 신호 아님.
- **신규 등장 항목 없음** — PR #216 시점 표에 명시되지 않았던 항목들 (`personality_compatibility_mini`, `saju_personality_mini`, `credit_deduct/calendar` 등) 은 baseline 본문 "…" 에 포함되어 있던 LOW 항목들로, 신규 출현이 아니라 단순히 본 보고서가 항목별 분해 표기를 채택한 차이.

---

## 4. PROGRESS.md 갱신 필요성

**불필요.** PR #216 §1.21 의 follow-up 후보 우선순위 (ai_chat → PR #217 완료 / lifetime-report → PR #218 OPEN) 그대로 유효.

---

## 5. 다음 재실행 시점

- 권장: 2026-08-17 (3개월 후) 또는 production 결제 흐름 / 신규 상품 출시 직후.
- 회귀 signal 발생 (`audit-payment-idempotency` / `audit-ai-chat-idempotency` / `audit-lifetime-report` 류에서 잠금 어긋남 검출) 시 즉시 재실행.

---

## 6. 원본 출력 (참조)

```
════════════════════════════════════════════════════════════════════════
  Business Activity Audit (last 30 days, since 2026-04-17)
════════════════════════════════════════════════════════════════════════

  event                    product                            events  unique_users
  --------------------------------------------------------------------------------
  reading_created          -                                     226  9
  credit_deduct            detail_report                          46  4
  entitlement_purchased    today-detail                           35  7
  fortune_feedback         general                                24  4
  credit_deduct            ai_chat                                22  3
  entitlement_purchased    lifetime-report                         8  4
  entitlement_purchased    monthly-calendar                        6  3
  entitlement_purchased    year-core                               5  3
  entitlement_purchased    personality_compatibility_mini          3  1
  fortune_feedback         work_meeting                            3  3
  entitlement_purchased    love-question                           2  2
  credit_deduct            calendar                                1  1
  entitlement_purchased    work-flow                               1  1
  entitlement_purchased    money-pattern                           1  1
  entitlement_purchased    saju_personality_mini                   1  1
  appointment_booked       -                                       1  1
```
