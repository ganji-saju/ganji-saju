# (A) 정리 작업 지시서 — 2026-05-22 검수 후속

> 검수 결과 발견된 **경미 정리 항목 3건**을 일괄 처리.
> 예상 소요: 10~15분.
> 모든 작업이 *문서·메타* 영역. 코드/로직 변경 없음.

---

## 작업 1 — audit-task.md §9 보강

**문제**: `audit:user-entitlements`는 인자 필수 CLI인데, audit-task.md §9가 인자 없이 `node scripts/audit-* | tail -40`으로 일률 실행 → 다음 검수 때도 같은 오탐 발생.

**처리**: `docs/claude-specs/10-audit-task.md` 의 §9 영역에 다음을 명시.

### 9-A. 변경할 위치

§9의 "범위 밖 5개(결제·인증) — 빌드 영향만" 부분 (가장 끝쪽 안내문).

### 9-B. 변경 내용

기존 텍스트를 다음으로 교체:

```markdown
**범위 밖 5개(결제·인증) — 빌드 영향만**:

- ai-chat-idempotency · business-activity · lucky-hybrid · payment-idempotency
  → 전체 스캔형. 인자 없이 정상 동작.

- **user-entitlements** → ⚠️ **운영자 수동 진단 CLI** (인자 필수)
  - 정상 동작: `node scripts/audit-user-entitlements.mjs <user-id-or-email>`
  - 인자 없이 실행하면 usage 출력 후 `exit(1)` → **이건 정상 동작**, 회귀 아님
  - 이 검수에서는 **exit code 점검 제외** (인자 없이 돌리면 항상 1)
  - 실제 무결성 확인이 필요하면 `SUPABASE_SERVICE_ROLE_KEY` 환경에서
    실유저 ID/email 인자와 함께 사용자가 직접 실행

`build` = `next build`로 audit 스크립트 **미체인** → 위 스크립트들의 결과는
Next.js 빌드 영향 없음(독립 실행 검사).
```

### 9-C. 검증

- 변경 후 `grep "인자 필수" docs/claude-specs/10-audit-task.md` 결과 1건 이상
- `grep "exit code 점검 제외" docs/claude-specs/10-audit-task.md` 결과 1건 이상

---

## 작업 2 — PROGRESS.md "최종 업데이트" 라인 갱신

**문제**: PROGRESS.md 최상단 "최종 업데이트" 라인이 `#315·#316 PR open(머지 대기)`로 남아 있으나 실제로는 머지 완료.

**처리**:

### 2-A. 위치

PROGRESS.md 파일 최상단 (가장 첫 부분).

### 2-B. 변경 내용

`#315·#316 PR open(머지 대기)` 부분을 `#315·#316 머지 완료 (2026-05-22 검수에서 확인)` 또는 *실제 머지 날짜*로 갱신.

```bash
# git log로 실제 머지 시점 확인
git log --all --oneline --merges | grep -E "#31[56]"
```

머지 커밋 날짜를 확인 후 정확한 문구으로 교체.

### 2-C. 추가 — 2026-05-22 종합 검수 결과 항목 추가

PROGRESS.md 적절한 위치에 다음 한 줄 항목 추가 (기존 포맷 따라):

```markdown
- 2026-05-22: 종합 검수 (audit-reports/2026-05-22-comprehensive-audit.md) —
  🟢 12 / 🟡 2 / 🔴 0. 점수 시스템 Phase 1~3 + 어휘 정책 + P0 6종 완료.
  잔존 🟡 2건: 총평 25~35문장 enforce 미확인 / 대운 LLM 다양성 미검증.
  audit:user-entitlements exit 1은 인자 필수 CLI 오탐(2026-05-22-user-entitlements-diagnosis.md 참조).
```

---

## 작업 3 — `docs/claude-specs/` git 추가·커밋

**문제**: 9개 스펙 문서 + audit-task.md가 `docs/claude-specs/`에 있으나 *untracked* 상태.

**처리**:

### 3-A. 파일 확인

```bash
ls docs/claude-specs/
# 예상: 01-comprehensive-diagnostic.md ~ 10-audit-task.md (10개)

git status docs/claude-specs/
# untracked 확인
```

### 3-B. 커밋

```bash
git add docs/claude-specs/

git commit -m "docs(claude-specs): add 10 strategy/spec/task documents

- 01 comprehensive-diagnostic, 02 naming-policy (top priority)
- 03 saju-total-review-llm-spec, 04 daewoon-llm-spec
- 05 saju-terms-dictionary, 06 verification-prompts
- 07 saju-score-spec, 08 phase-1-task, 09 phase-2-3-task
- 10 audit-task

Anchor specs for ongoing naming policy / score system / LLM content work.
Top precedence: docs/claude-specs/02-naming-policy.md (per CLAUDE.md)."
```

### 3-C. 검증

```bash
git log -1 --stat | head -20
# 커밋 메시지 + 10개 파일 추가 확인
```

---

## 작업 4 — 검증 보고

각 작업 완료 후 다음 형식으로 한 줄 보고:

```
✅ 작업 1: audit-task.md §9 보강 완료 (변경 줄 수: N)
✅ 작업 2: PROGRESS.md 최종 업데이트 라인 갱신 + 검수 결과 항목 추가
✅ 작업 3: docs/claude-specs/ git add + commit (커밋 해시: abc1234)
```

전체 완료 후:

```
[최종 보고]
- 변경 파일: N개
- 커밋 수: 1 (또는 2 — 작업 1·2를 별도 커밋할 경우)
- 작업 시간: N분
```

---

## 작업 원칙

- **모두 문서·메타 작업** — src/ 또는 scripts/ 코드 변경 금지
- 한 번에 하나씩, 각 작업 완료 후 *다음 작업*으로 진행
- 작업 1·2를 하나의 커밋으로 묶거나 따로 해도 OK (사용자 판단)
- 커밋 메시지에 검수 보고서 참조 (`audit-reports/2026-05-22-comprehensive-audit.md`) 명시 권장

---

## 한 줄 요약

> **3개 정리 작업 — audit-task.md §9 user-entitlements 예외 명시 + PROGRESS.md 머지 상태/검수 결과 갱신 + docs/claude-specs/ git 추가. 모두 문서 작업, 코드 변경 없음.**
