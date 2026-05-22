# ganji-saju 종합 검수 작업 지시서 (2026-05-22)

> Claude Code가 `/Users/kionya/ganji-saju`에서 실행할 **중간 깊이(B 옵션) 종합 검수**.
>
> 환경: macOS, npm, Next.js 16, Vitest, Playwright.
>
> 출력: `audit-reports/2026-05-22-comprehensive-audit.md` (오늘 날짜 새 보고서).

> **⚠️ 구현 현황 정정 (2026-05-22 검수 반영)**
> 본 지시서 일부 점검 명령은 **PascalCase 컴포넌트 파일명**(`SajuScoreCard.tsx`)과 **`tailwind.config.ts`**를 가정하나, 실제 구현은:
> - 컴포넌트 파일 = **kebab-case** (`saju-score-card.tsx`·`score-breakdown-card.tsx`·`ohaeng-bar-chart.tsx`·`lifetime-keys-carousel.tsx`·`lock-gate.tsx`), export 명은 PascalCase로 사양 일치.
> - 토큰 = **Tailwind v4 `@theme`** (`src/app/styles/tokens.css`) — `tailwind.config.ts` 없음.
> 재실행 시 위 경로로 치환할 것. 보정된 검사 결과는 `audit-reports/2026-05-22-comprehensive-audit.md` §5·§8 수록.

---

## 0. 검수 배경

지난 몇 주간 코덱스 / Claude Code / ChatGPT / Claude(채팅) 4개 AI가 섞여 작업한 결과물의 *현재 상태*를 정확히 파악.

기준이 되는 **9개 스펙 문서**:

1. `ganjisaju-comprehensive-diagnostic.md` — 통합 진단·로드맵
2. `daewoon-llm-spec.md` — 대운 풀이 LLM 스펙
3. `saju-terms-dictionary.json` — 명리 용어 사전
4. `verification-prompts.md` — 8단계 검증 프롬프트
5. `saju-total-review-llm-spec.md` — 사주 총평 LLM 스펙
6. `saju-score-spec.md` — 점수 시스템 전체 설계
7. `naming-policy.md` — **어휘 정책 (최상위 우선순위)**
8. `phase-1-task.md` — 점수 엔진 작업 지시서
9. `phase-2-3-task.md` — UI 컴포넌트 작업 지시서

이 9개 문서가 명시한 작업이 *얼마나, 어떻게* 구현되었는지 확인.

**중요**: 9개 문서가 `docs/` 하위 어딘가에 있을 수도, 아직 프로젝트에 통합되지 않았을 수도 있음. 검수 첫 단계에서 위치 확인.

---

## 1. 사전 점검 (시작 전 필수 확인)

### 1-1. 작업 디렉토리 + 권한

```bash
pwd  # /Users/kionya/ganji-saju 인지 확인
ls audit-reports/  # 쓰기 권한 확인
```

### 1-2. 9개 스펙 문서 위치 파악

```bash
echo "=== 9개 스펙 문서 위치 탐색 ==="
for doc in "naming-policy" "saju-score-spec" "saju-total-review-llm-spec" \
          "daewoon-llm-spec" "saju-terms-dictionary" "phase-1-task" \
          "phase-2-3-task" "ganjisaju-comprehensive-diagnostic" \
          "verification-prompts"; do
  found=$(find . -name "*${doc}*" -not -path "./node_modules/*" -not -path "./.next/*" -not -path "./.git/*" 2>/dev/null)
  if [ -z "$found" ]; then
    echo "❌ ${doc}: 없음"
  else
    echo "✅ ${doc}:"
    echo "$found" | sed 's/^/   /'
  fi
done
```

**중요한 분기점**:
- 9개 모두 없음 → 스펙 자체가 통합 안 됨. 우선 *어디 둘지* 사용자에게 확인 후 진행
- 일부만 있음 → 그래도 진행하되, 누락된 문서는 보고서에 명시
- 모두 있음 → 정상 진행

위 결과를 보고서 **§0 사전 점검** 섹션에 기록.

### 1-3. 이전 audit 보고서와의 관계

```bash
echo "=== 이전 audit 보고서 목록 ==="
ls -la audit-reports/

echo ""
echo "=== 가장 최근 보고서 (2026-05-20) 핵심 요약 ==="
head -50 audit-reports/2026-05-20-narrative-tone-audit.md
```

가장 최근 보고서(`2026-05-20-narrative-tone-audit.md`)가 이미 본문 톤을 검사했을 가능성이 큼. 이번 검수는 *그 이후의 변화*를 추적하는 성격.

---

## 2. 출력 보고서 형식

`audit-reports/2026-05-22-comprehensive-audit.md` 한 파일에 모든 결과 작성.

각 섹션은 다음 4개 정보:

```markdown
### [섹션 제목]

**상태**: ✅ PASS / ⚠️ PARTIAL / ❌ FAIL / 🔍 SKIP

**확인 결과**:
- [구체 발견 사항, 수치, 파일 경로]

**증거** (선택):
```code/grep 출력 인용 (긴 결과는 head/tail로 요약)```

**다음 액션 권장** (있다면):
- [후속 처리 권장]
```

**파일 작성 원칙**: 각 섹션 완료 직후 `>>` 로 append. 중간에 실패해도 결과 보존.

---

## 3. Section 1 — 작업 환경 점검

### 3-1. git 작업 흔적

```bash
echo "=== git 상태 ==="
git status -sb
git log --oneline | head -3

echo ""
echo "=== 최근 3주 커밋 통계 ==="
git log --since="3 weeks ago" --pretty=format:"%h %ai %an %s" | head -50

echo ""
echo "=== 최근 3주 작업자별 커밋 수 ==="
git log --since="3 weeks ago" --pretty=format:"%an" | sort | uniq -c | sort -rn

echo ""
echo "=== 최근 3주 변경 빈도 Top 30 파일 ==="
git log --since="3 weeks ago" --name-only --pretty=format: \
  | grep -v "^$" | sort | uniq -c | sort -rn | head -30

echo ""
echo "=== AI 흔적 커밋 메시지 ==="
git log --since="3 weeks ago" --pretty=format:"%h %s" \
  | grep -iE "claude|codex|gpt|cursor|ai " | head -30
```

**보고**:
- 최근 3주 총 커밋 수
- 가장 활발한 작업 파일 Top 10
- 작업자 분포 (사용자 본인 vs AI 자동)
- AI 흔적 커밋 패턴

### 3-2. PROGRESS.md / CLAUDE.md / AGENTS.md 점검

```bash
echo "=== 핵심 문서 마지막 수정 ==="
ls -la PROGRESS.md CLAUDE.md AGENTS.md 2>/dev/null

echo ""
echo "=== PROGRESS.md 최근 50줄 ==="
tail -50 PROGRESS.md

echo ""
echo "=== CLAUDE.md에 naming-policy 언급 여부 ==="
grep -n "naming-policy\|naming policy\|어휘 정책\|X 기운" CLAUDE.md 2>/dev/null

echo ""
echo "=== CLAUDE.md vs AGENTS.md 비교 (충돌 위험) ==="
diff <(head -100 CLAUDE.md 2>/dev/null) <(head -100 AGENTS.md 2>/dev/null) | head -30
```

**보고**:
- PROGRESS.md 최근 항목들이 9개 스펙 작업을 반영하는지
- CLAUDE.md에 naming-policy 어휘 규칙이 포함됐는지
- CLAUDE.md ↔ AGENTS.md 간 *모순*이 있는지

---

## 4. Section 2 — P0 버그 6개 잔존 검사

진단서(`ganjisaju-comprehensive-diagnostic.md`)에서 식별한 P0 6개:

```bash
echo "=== P0 #1: '내 내 내' 변수 누수 ==="
grep -rn "내 내 내\|내 내" src/ --include="*.ts" --include="*.tsx" --include="*.json" 2>/dev/null \
  | grep -v "/__tests__/\|\.test\.\|\.spec\.\|//.*예시\|forbidden" | head -10

echo ""
echo "=== P0 #2: '근' 한자 매핑 오류 ==="
grep -rn "근표\|근 내 핵심" src/ --include="*.ts" --include="*.tsx" --include="*.json" 2>/dev/null | head -10

echo ""
echo "=== P0 #3: 영어 enum 누수 (본문 노출) ==="
# 코드 enum 값이 아닌 본문 텍스트에 노출된 weak/balanced 검색
grep -rnE ">[^<]*\\b(weak|balanced|timing|strong)\\b[^<]*<|\"[^\"]*\\b(weak|balanced|timing|strong)\\b[^\"]*\"" \
  src/ --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -v "interface\|type \|enum\|import\|const.*=" | head -10

echo ""
echo "=== P0 #4: 종결문 접속 비문 ==="
grep -rnE "[다요]과\\s|[다요]를\\s+같이" src/ --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -v "/__tests__/" | head -10

echo ""
echo "=== P0 #5: '커안쪽 결만' 변수 누수 ==="
grep -rn "커안쪽\|결만 시험" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -5

echo ""
echo "=== P0 #6: fallback 자극 표현 ==="
grep -rnE "대박 나는|암흑기|텅장|꿀팁" src/ --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -v "forbidden\|금지\|클리셰\|/__tests__/\|naming-policy" | head -10
```

**보고**: 각 P0별로
- 발견 건수 (0이면 ✅, 1+이면 ❌)
- 발견 시 파일 경로 + 줄 번호
- 추가 발견된 유사 변형

---

## 5. Section 3 — 어휘 정책 (naming-policy) 적용 검사

### 5-1. 금지 어휘 일괄 검색

```bash
echo "=== 자연 비유 + '의 결' (가장 흔한 잔존) ==="
grep -rnE "(새싹|햇살|흙|쇠|물)의\\s*결" src/ --include="*.ts" --include="*.tsx" --include="*.json" 2>/dev/null \
  | grep -v "/__tests__/\|naming-policy\|//.*BEFORE\|forbidden\|금지" | head -20

echo ""
echo "=== '결단과/안정과/열정과/시작과/지혜과' (구 라벨) ==="
grep -rnE "결단과|안정과|열정과|시작과|지혜과" src/ --include="*.ts" --include="*.tsx" --include="*.json" 2>/dev/null \
  | grep -v "/__tests__/\|naming-policy\|forbidden" | head -20

echo ""
echo "=== 십성 추상명사 ('표현의 기운' 등) ==="
grep -rnE "(표현|생각|절제|직관|돌봄|관찰|베푸는)의\\s*기운" src/ --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -v "/__tests__/\|naming-policy\|forbidden" | head -20

echo ""
echo "=== 오행 'X의 기운' 형태 (X 기운으로 표기해야) ==="
grep -rnE "(목|화|토|금|수)의\\s*기운" src/ --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -v "/__tests__/\|naming-policy\|forbidden" | head -20

echo ""
echo "=== 'X형 사주' 신조어 ==="
grep -rnE "(표현|돌봄|재물|관계|기준)형\\s*사주" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -10
```

### 5-2. 오행 라벨 사용 빈도

```bash
echo "=== '목 기운' ~ '수 기운' 5개 라벨 사용 빈도 ==="
for label in "목 기운" "화 기운" "토 기운" "금 기운" "수 기운"; do
  count=$(grep -rn "$label" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
  echo "  $label: $count건"
done
```

### 5-3. 면책 문구 표시

```bash
echo "=== 면책 문구 노출 위치 ==="
grep -rln "사주는 좋고 나쁨이 없습니다\|활용도가 다를 뿐이에요" src/ --include="*.ts" --include="*.tsx" 2>/dev/null
```

**보고**:
- 금지 어휘 위반 *총합*
- 가장 자주 위반된 어휘 Top 3
- 위반 집중 파일 Top 5
- 면책 문구가 점수 카드에서 *항상* 표시되는지

---

## 6. Section 4 — Phase 1 점수 엔진 구현 확인

### 6-1. 파일 존재 여부

```bash
echo "=== src/lib/saju-score/ 폴더 ==="
ls -la src/lib/saju-score/ 2>/dev/null || echo "❌ 폴더 없음 — Phase 1 미시작"

echo ""
echo "=== 기대 파일 8개 + tests ==="
for file in types formulas helpers labels ohaeng index test-cases distribution; do
  path="src/lib/saju-score/${file}.ts"
  if [ -f "$path" ]; then
    echo "✅ ${file}.ts ($(wc -l < $path)줄)"
  else
    echo "❌ ${file}.ts 없음"
  fi
done

echo ""
echo "=== 테스트 파일 ==="
ls -la src/lib/saju-score/__tests__/ 2>/dev/null
```

### 6-2. F1~F5 함수 export 확인

```bash
echo "=== F1~F5 export ==="
grep -n "export function calculateF[1-5]" src/lib/saju-score/formulas.ts 2>/dev/null

echo ""
echo "=== computeSajuScore() ==="
grep -n "export function computeSajuScore" src/lib/saju-score/index.ts 2>/dev/null
```

### 6-3. 단위 테스트 실행

```bash
echo "=== Vitest 실행 ==="
npx vitest run src/lib/saju-score --reporter=verbose 2>&1 | tail -80
```

### 6-4. 분포 검증 결과

```bash
echo "=== 분포 검증 ==="
npx vitest run src/lib/saju-score/__tests__/distribution.test.ts --reporter=verbose 2>&1 | tail -50

# 테스트 케이스 수
echo ""
echo "=== 테스트 케이스 수 ==="
grep -c "id: '" src/lib/saju-score/test-cases.ts 2>/dev/null || echo "test-cases.ts 없음"
```

**보고**:
- 9개 파일 중 N개 존재
- F1~F5 모두 export 되는지
- 테스트 통과율 (예: 28/32)
- 50개 분포: 평균/표준편차/5단계 비율
- 분포 수용 기준 (평균 65~70, 표준편차 ~12) 통과 여부

---

## 7. Section 5 — Phase 2+3 UI 컴포넌트 확인

### 7-1. 컴포넌트 파일 존재

```bash
echo "=== src/components/saju-score/ 폴더 ==="
ls -la src/components/saju-score/ 2>/dev/null || echo "❌ 폴더 없음 — Phase 2+3 미시작"

echo ""
echo "=== 기대 컴포넌트 5개 ==="
for comp in SajuScoreCard ScoreBreakdownCard OhaengChart LifetimeKeysCarousel LockGate; do
  path="src/components/saju-score/${comp}.tsx"
  if [ -f "$path" ]; then
    echo "✅ ${comp}.tsx ($(wc -l < $path)줄)"
  else
    echo "❌ ${comp}.tsx 없음"
  fi
done
```

### 7-2. Tailwind 토큰 추가 확인

```bash
echo "=== 점수 색상 토큰 ==="
grep -E "score-(excellent|good|neutral|mindful|potential)" tailwind.config.ts tailwind.config.js 2>/dev/null

echo ""
echo "=== 오행 색상 토큰 ==="
grep -E "ohaeng-(mok|hwa|to|geum|su)" tailwind.config.ts tailwind.config.js 2>/dev/null

echo ""
echo "=== 카운트업 / bar-fill 애니메이션 ==="
grep -E "score-count-up|bar-fill" tailwind.config.ts tailwind.config.js 2>/dev/null
```

### 7-3. 잠금 UI + 결제 모달

```bash
echo "=== LockGate 핵심 요소 ==="
if [ -f src/components/saju-score/LockGate.tsx ]; then
  grep -n "550원\|풀이 보기\|FACTOR_VALUE_LINES\|결제 모달\|LockPaymentModal" \
    src/components/saju-score/LockGate.tsx 2>/dev/null | head -10
fi
```

### 7-4. 총평 탭 통합 확인

```bash
echo "=== 새 컴포넌트 사용 위치 ==="
grep -rln "SajuScoreCard\|ScoreBreakdownCard\|OhaengChart\|LifetimeKeysCarousel" \
  src/app src/features 2>/dev/null | head -10

echo ""
echo "=== 사용 라인 ==="
grep -rn "<SajuScoreCard\|<ScoreBreakdownCard\|<OhaengChart\|<LifetimeKeysCarousel" src/ 2>/dev/null | head -10
```

**보고**: 5개 컴포넌트 존재 여부 / Tailwind 토큰 / 총평 탭 통합 여부

---

## 8. Section 6 — LLM 호출 코드 검증

### 8-1. LLM 호출 위치

```bash
echo "=== LLM 호출 파일 ==="
grep -rln "openai\|anthropic\|gpt-\|claude-\|chat\.completions" src/ \
  --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -v "/__tests__/\|\.test\.\|\.spec\." | head -10

echo ""
echo "=== 총평/대운 LLM 함수 ==="
grep -rln "interpretTotal\|interpretDaewoon\|generateTotal\|generateDaewoon\|TotalReview" src/ 2>/dev/null | head -10
```

### 8-2. 시스템 프롬프트 검증

```bash
echo "=== 'X 기운' 시스템 프롬프트 등장 ==="
grep -rn "목 기운\|X 기운으로 표기\|naming-policy" src/ --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -v "/__tests__/" | head -10

echo ""
echo "=== '결 단어 제한' 시스템 프롬프트 ==="
grep -rn "'결' 단어\|결 단어 사용\|결 단어 사용 제한" src/ 2>/dev/null | head -10

echo ""
echo "=== 한자 본문 노출 금지 규칙 ==="
grep -rn "한자.*노출.*금지\|한자.*본문.*0개\|한자(漢字)" src/ 2>/dev/null | head -10
```

### 8-3. 후처리 검증 함수 적용

```bash
echo "=== validate 함수들 ==="
grep -rln "validateDaewoonOutput\|validateTotalReview\|validateNamingPolicy\|naming.*violation" src/ 2>/dev/null
```

**보고**: LLM 호출 파일 위치 / 시스템 프롬프트에 naming-policy 규칙 포함 여부 / 후처리 검증 적용 여부

---

## 9. Section 7 — 기존 audit 스크립트 실행

`scripts/` 폴더의 audit 스크립트들 실행:

```bash
echo "=== audit-narrative-tone.mjs ==="
node scripts/audit-narrative-tone.mjs 2>&1 | tail -40

echo ""
echo "=== audit-redesign-coverage.mjs ==="
node scripts/audit-redesign-coverage.mjs 2>&1 | tail -40

echo ""
echo "=== audit-mockup-placeholders.mjs ==="
node scripts/audit-mockup-placeholders.mjs 2>&1 | tail -40

echo ""
echo "=== audit-dead-anchors.mjs ==="
node scripts/audit-dead-anchors.mjs 2>&1 | tail -40

echo ""
echo "=== audit-lifetime-report.mjs ==="
node scripts/audit-lifetime-report.mjs 2>&1 | tail -40
```

**보고**:
- 5개 스크립트 중 N개 통과 (exit code 0)
- FAIL 스크립트의 핵심 메시지
- `audit-narrative-tone.mjs` 결과를 가장 비중 있게 — 이게 본문 톤의 *기계 평가*

**범위 밖 5개(결제·인증) — 빌드 영향만**:

- `audit-ai-chat-idempotency` · `audit-business-activity` · `audit-lucky-hybrid` · `audit-payment-idempotency`
  → 전체 스캔형. 인자 없이 정상 동작.
- **`audit-user-entitlements`** → ⚠️ **운영자 수동 진단 CLI (인자 필수)**
  - 정상 호출: `node scripts/audit-user-entitlements.mjs <user-id-or-email>`
  - 인자 없이 실행하면 usage 출력 후 `exit(1)` → **이건 정상 동작, 회귀 아님**
  - 이 검수에서는 **exit code 점검 제외** (인자 없이 돌리면 항상 1)
  - 실제 무결성 확인은 `SUPABASE_SERVICE_ROLE_KEY` 환경에서 실유저 ID/email 인자와 함께 사용자가 직접 실행

`build` = `next build` 로 audit 스크립트 **미체인** → 위 스크립트 결과는 Next.js 빌드 영향 없음(독립 실행 검사). (근거: `audit-reports/2026-05-22-user-entitlements-diagnosis.md`)

---

## 10. Section 8 — 컴포넌트 품질 검사 (B 깊이 핵심)

5개 핵심 컴포넌트 각각의 *코드 품질* 점검.

```bash
echo "=== 컴포넌트별 품질 표 ==="
echo "| 컴포넌트 | 존재 | 줄수 | 'use client' | 금지어휘 | 면책문구 | TODO | any | 하드코딩색상 |"
echo "|--------|----|----|------------|--------|--------|-----|----|------------|"

for COMP in SajuScoreCard ScoreBreakdownCard OhaengChart LifetimeKeysCarousel LockGate; do
  FILE="src/components/saju-score/${COMP}.tsx"
  if [ -f "$FILE" ]; then
    lines=$(wc -l < $FILE)
    useclient=$(grep -c "'use client'" $FILE)
    violations=$(grep -cE "(새싹|햇살|쇠|흙|물)의\\s*결|결단과|안정과" $FILE)
    disclaimer=$(grep -c "사주는 좋고 나쁨이 없습니다" $FILE)
    todo=$(grep -cE "TODO|FIXME" $FILE)
    any=$(grep -c ": any" $FILE)
    hardcode=$(grep -cE "#[0-9a-fA-F]{6}\b" $FILE)
    echo "| ${COMP} | ✅ | ${lines} | ${useclient} | ${violations} | ${disclaimer} | ${todo} | ${any} | ${hardcode} |"
  else
    echo "| ${COMP} | ❌ | - | - | - | - | - | - | - |"
  fi
done
```

각 컴포넌트의 **추가 깊이 점검**:

```bash
echo ""
echo "=== SajuScoreCard 카운트업 애니메이션 ==="
grep -n "useCountUp\|requestAnimationFrame\|score-count-up" src/components/saju-score/SajuScoreCard.tsx 2>/dev/null

echo ""
echo "=== ScoreBreakdownCard LockGate 통합 ==="
grep -n "<LockGate\|import.*LockGate" src/components/saju-score/ScoreBreakdownCard.tsx 2>/dev/null

echo ""
echo "=== OhaengChart 라벨 ('X 기운' 형태) ==="
grep -n "기운\|결" src/components/saju-score/OhaengChart.tsx 2>/dev/null | head -10

echo ""
echo "=== LockGate 결제 모달 구조 ==="
grep -n "Modal\|Dialog\|모달\|fixed inset-0" src/components/saju-score/LockGate.tsx 2>/dev/null | head -10
```

**보고**: 위 표 + 각 컴포넌트의 *구현 품질* 한 줄 평가

---

## 11. Section 9 — 사이트맵·라우팅 검수

```bash
echo "=== 사주 결과 라우트 ==="
find src/app -type d -name "*saju*" 2>/dev/null

echo ""
echo "=== 총평 탭 컴포넌트 위치 ==="
grep -rln "총평\|TotalReview\|saju-total\|overview-tab" src/app src/components src/features 2>/dev/null | head -10

echo ""
echo "=== 대운 / 세운 / 일진 페이지 ==="
find src/app -type f -name "page.tsx" 2>/dev/null \
  | xargs grep -l "daewoon\|saewoon\|iljin\|대운\|세운\|일진" 2>/dev/null | head -10

echo ""
echo "=== 결제 / 잠금 진입점 ==="
find src -type f \( -name "*payment*" -o -name "*Payment*" \) 2>/dev/null \
  | grep -v "/__tests__/\|\.test\." | head -10
```

**보고**: 사주 결과 페이지 / 총평 탭 / 새 컴포넌트 *통합* 위치

---

## 12. Section 10 — Playwright E2E 확인 (있다면)

```bash
echo "=== E2E 테스트 파일 ==="
ls e2e/

echo ""
echo "=== saju.spec.ts 마지막 수정 + 라인 수 ==="
wc -l e2e/saju.spec.ts 2>/dev/null
git log --pretty=format:"%ai %s" e2e/saju.spec.ts | head -5

echo ""
echo "=== 점수 시스템 / 잠금 UI 테스트 ==="
grep -rln "SajuScoreCard\|ScoreBreakdown\|OhaengChart\|LockGate\|점수\|잠금" e2e/ 2>/dev/null
```

**보고**:
- saju.spec.ts가 새 컴포넌트를 커버하는지
- 점수 시스템·잠금 UI 테스트가 있는지

(실제 실행은 시간 오래 걸리니 *스킵*. 파일 분석만.)

---

## 13. Section 11 — 종합 보고서

### 13-1. 9개 스펙 문서별 적용도 표

| # | 스펙 문서 | 위치 발견 | 적용 시작 | 적용 완료 % | 검증 통과 | 잔존 이슈 |
|---|---------|--------|--------|---------|--------|----------|
| 1 | naming-policy.md | ✅/❌ | ✅/❌ | %  | ✅/❌ | N건 |
| ... |

각 행 채우기.

### 13-2. 14개 작업 항목 분류

각 작업 항목을 **🟢 완료 / 🟡 부분 / 🔴 미적용 / ⚪ 보류** 로 분류:

1. P0 #1 "내 내 내" 수정
2. P0 #2 "근" 매핑 수정
3. P0 #3 영어 enum 수정
4. P0 #4 종결문 비문 수정
5. P0 #5 "커안쪽" 수정
6. P0 #6 챕터 제목 fallback 수정
7. 어휘 정책 (naming-policy) 적용
8. 총평 본문 LLM 확장 (7→25~35문장)
9. 대운 9개 다양성
10. 점수 시스템 Phase 1 (계산 엔진)
11. 점수 시스템 Phase 2 (라벨/색상)
12. 점수 시스템 Phase 3 (UI 컴포넌트)
13. 잠금 UI / 결제 모달
14. 총평 탭 통합

### 13-3. AI별 작업 흔적 추정

git log + 파일 헤더 + 작성 스타일로 추정:
- **Claude Code**가 만든 것으로 보이는 영역
- **Codex CLI**가 만든 것으로 보이는 영역
- **ChatGPT 수동 적용** 흔적
- **Claude(채팅)**의 스펙 작성 영역
- **사용자 직접 작성** 영역

### 13-4. 우선순위 다음 액션 Top 5

발견된 이슈 중 ROI 가장 높은 5개:

| # | 이슈 | 영향 범위 | 예상 소요 | 권장 처리 |
|---|-----|--------|---------|---------|
| 1 | ... | ... | ... | Claude Code / Codex / 수동 |
| ... |

---

## 14. 실행 원칙 (중요)

### 14-1. 단계별 진행

각 섹션 *완료 직후* `audit-reports/2026-05-22-comprehensive-audit.md`에 `>>` append. 중간 실패해도 진척 보존.

### 14-2. 결과 요약

명령 결과 100줄 이상이면 처음 30줄 + 마지막 30줄만 인용. 나머지는 *"... (N건 생략)"*.

### 14-3. 예상 밖 상황 즉시 보고

다음 상황은 진행 중단하고 사용자에게 알림:
- 9개 스펙 문서가 어디에도 없음
- 점수 엔진 코드가 *완전히 다른 구조*로 구현됨
- 컴포넌트 이름이 사양과 다름 (예: `<ScoreCard />` 대신 `<SajuMainScore />`)
- 새 AI가 만든 *예상 못한 파일*이 발견됨
- 단위 테스트 30%+ 실패

### 14-4. 너무 깊이 들어가지 말 것

이 검수는 **B 중간 깊이**. 다음은 *하지 마라*:
- 코드 리팩토링
- 버그 직접 수정
- 새 파일 작성 (보고서 외)
- 의존성 추가
- git 변경 (검수는 *read-only*)

발견한 문제는 *보고서에 기록*만. 처리는 후속 작업.

---

## 15. 최종 보고 요약

모든 섹션 완료 후, **이 대화에 다음 3가지 전달**:

1. **보고서 파일 경로 + 총 줄 수**:
   ```
   audit-reports/2026-05-22-comprehensive-audit.md (N줄)
   ```

2. **14개 작업 항목 분류 통계**:
   ```
   🟢 완료: N개
   🟡 부분: N개
   🔴 미적용: N개
   ⚪ 보류: N개
   ```

3. **가장 시급한 액션 Top 3** (보고서 §13-4 발췌)

이 3가지면 다음 작업 방향을 즉시 정할 수 있음.

---

## 16. Claude Code 즉시 복사 프롬프트

```
ganji-saju 프로젝트의 종합 검수 (B 중간 깊이)를 진행해줘.

작업 지시서: audit-task.md
환경: macOS, npm, Next.js 16, Vitest, Playwright.
출력: audit-reports/2026-05-22-comprehensive-audit.md

[순서]
1. §1 사전 점검 — 9개 스펙 문서 위치 + 권한 확인
2. §2 보고서 헤더 작성 + 환경 정보
3. Section 1~10을 순차 실행 (§3~§12)
   각 섹션 결과를 보고서에 append
4. Section 11 종합 보고서 작성 (§13)

[원칙]
- 단계별로 (한 번에 다 실행 X)
- 결과 100줄+ 이면 head/tail로 요약
- 예상 밖 상황 발견 시 즉시 보고
- 검수는 read-only. 코드 수정/리팩토링 절대 금지.

[보고]
완료 시 이 대화에 3가지 전달:
1. 보고서 경로 + 줄 수
2. 14개 작업 분류 통계 (🟢/🟡/🔴/⚪ 개수)
3. 가장 시급한 액션 Top 3

[시작 전 확인]
1. pwd가 /Users/kionya/ganji-saju 인가
2. 9개 스펙 문서 위치 (§1-2 명령으로 탐색)
3. audit-reports/ 쓰기 권한 OK

위 3개 확인 후 시작.
```

---

## 17. 검수 후 워크플로

```
Claude Code 검수 완료
   ↓
사용자가 이 대화에 §15의 3가지 전달
   ↓
저(클로드)와 함께 결과 해석
   ↓
14개 작업 항목 중 🔴/🟡 우선순위 정렬
   ↓
다음 작업 지시서 작성 → Claude Code 또는 직접 처리
```

가장 가능성 큰 후속 작업 시나리오 4가지:

1. **P0 잔존 버그 일괄 수정** (가장 빠른 ROI)
2. **naming-policy 마이그레이션 마무리** (50% 적용 시)
3. **Phase 2+3 UI 컴포넌트 구현** (Phase 1만 완료 시)
4. **LLM 시스템 프롬프트 일관성 보강** (어휘 정책 누락 시)

검수 결과 보고 어느 쪽인지 함께 정함.

---

## 18. 한 줄 요약

> **§16 프롬프트를 Claude Code에 그대로 위임 → §15의 3가지 결과를 이 대화에 공유 → 함께 다음 작업 정함. 사용자님이 직접 분석할 필요 없음.**
