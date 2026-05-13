# Refactor Safety Runbook

ganji-saju 코드베이스 개선 작업의 단계별 실행 매뉴얼.  
각 STEP은 독립 브랜치에서 실행하고, 검증 통과 시에만 main에 병합한다.

---

## 사전 준비 (모든 STEP 전 1회)

```bash
# 1. 현재 작업 상태 커밋
git add -A
git commit -m "chore: save state before refactor"

# 2. 복구용 안전 태그 생성 (날짜 포함)
git tag refactor-start-$(date +%Y%m%d)

# 3. 사전 점검 실행 — 오류 있으면 중단
npm run preflight
```

> `preflight` 결과에서 **오류(✗)** 가 있으면 작업 시작 금지.  
> **경고(⚠)** 만 있으면 내용 확인 후 판단.

---

## 각 STEP 실행 패턴

모든 STEP은 아래 패턴을 반복한다:

```bash
# ① 격리 브랜치 생성
git checkout -b refactor/step-N-이름

# ② Codex에 해당 STEP 프롬프트 실행

# ③ 자동 검증
npm run typecheck          # TypeScript 오류 확인
npm test                   # 유닛 테스트
npm run verify:imports     # 끊어진 import 확인

# ④ 통과 시 main에 병합
git checkout main
git merge --no-ff refactor/step-N-이름 -m "refactor: step N 완료"

# ⑤ 실패 시 브랜치 버리기 (복구)
git checkout main
git branch -D refactor/step-N-이름
```

---

## STEP 1 — 공통 유틸리티 추출

**위험도**: 낮음  
**브랜치**: `refactor/step-1-api-utils`

```bash
git checkout -b refactor/step-1-api-utils
```

**Codex 프롬프트** → [별도 문서]

**완료 후 검증**:
```bash
npm run typecheck
npm test
node scripts/verify-imports.mjs --step=1

# readString 중복이 0개인지 직접 확인
grep -rn "function readString(" src/ --include="*.ts" --include="*.tsx" \
  | grep -v api-utils | grep -v ".test."
```

**예상 결과**: `api-utils.ts` 외에 `readString` 정의 0개.

---

## STEP 2 — 데드 파일 삭제

**위험도**: 낮음  
**브랜치**: `refactor/step-2-dead-files`

```bash
git checkout -b refactor/step-2-dead-files
```

**삭제 전 재확인** (Codex가 실행 전 반드시 이 명령을 실행해야 함):
```bash
grep -rn "components/site-header" src/ --include="*.ts" --include="*.tsx"
grep -rn "lib/site-navigation"    src/ --include="*.ts" --include="*.tsx"
grep -rn "lib/home-content"       src/ --include="*.ts" --include="*.tsx"
```
위 세 명령 모두 결과가 **0줄**이어야 삭제 진행.

**완료 후 검증**:
```bash
npm run typecheck
npm run verify:imports --step=2
```

---

## STEP 3 — route-helpers 중복 통합

**위험도**: 중간  
**브랜치**: `refactor/step-3-route-helpers`

**완료 후 검증**:
```bash
npm run typecheck
npm test
# API 동작 확인 (개발 서버 실행 후)
npm run smoke
```

**수동 확인**: 사주 해석 요청 → AI 응답이 정상적으로 오는지.

---

## STEP 4 — import 경로 단일화

**위험도**: 낮음  
**브랜치**: `refactor/step-4-import-paths`

**완료 후 검증**:
```bash
npm run typecheck
node scripts/verify-imports.mjs --step=4

# passthrough 파일 삭제 후 참조 0개 확인
grep -rn "from '@/lib/saju/report'" src/ --include="*.ts" --include="*.tsx" \
  | grep -v "report-metadata\|report-contract"
```

---

## STEP 5 — 리다이렉트 next.config.ts 이동

**위험도**: 중간  
**브랜치**: `refactor/step-5-redirects`

**⚠ 제외 주의**: 아래 파일은 단순 redirect가 아니므로 절대 삭제하지 않는다:
- `app/verification/page.tsx` — 조건부 auth 확인 + 실제 UI
- `app/dialogue/page.tsx` — 실제 콘텐츠
- `app/saju/page.tsx` — 동적 로직
- `app/zodiac/[slug]/page.tsx` — 동적 slug
- `app/today-fortune/page.tsx` — 실제 콘텐츠
- `app/today-fortune/result/page.tsx` — 실제 콘텐츠

**삭제 안전한 파일만** (14개):
`about-engine`, `guide`, `gunghap`, `today`, `method`, `method/[slug]`,
`myeongri/ten-gods`, `saju/new/consent`, `saju/new/empathy`,
`saju/new/nickname`, `saju/new/birth`, `notifications/schedule`,
`notifications/widget`, `my/results`, `vault`

**완료 후 검증**:
```bash
npm run build  # 빌드 필수
npm run smoke  # 리다이렉트 경로 응답 코드 확인
```

**브라우저 확인**: `/about-engine` → `/interpretation` 으로 이동하는지.

---

## STEP 6 — 미사용 home 섹션 정리

**위험도**: 낮음  
**브랜치**: `refactor/step-6-home-sections`

**삭제 전 재확인**:
```bash
grep -rn "features/home/hero-section\|features/home/service-entry\|features/home/membership-section\|features/home/seo-entry\|features/home/tarot-section\|features/home/service-intake-preview\|features/home/compatibility-section" \
  src/app/ --include="*.tsx" --include="*.ts"
```
결과가 **0줄**이어야 삭제 진행.

**content.ts는 유지**: `HOUR_OPTIONS`를 `unified-birth-info-fields.tsx`가 사용함.

---

## STEP 7 — Profile SELECT 상수 통합

**위험도**: 높음  
**브랜치**: `refactor/step-7-profile-select`

**사전 조건 확인** (실패 시 이 STEP 건너뜀):
```bash
# 운영 DB에 모든 컬럼이 존재하는지 확인
# Supabase 대시보드에서 profiles 테이블에
# birth_calendar_type, birth_time_rule, preferred_counselor 컬럼 존재 여부 확인
```

**완료 후 검증**:
```bash
npm run typecheck
npm test
# 로그인 후 /my/profile 에서 프로필 저장/불러오기 동작 확인
```

---

## STEP 8 — 빈 폴더 정리

**위험도**: 매우 낮음  
**브랜치**: `refactor/step-8-empty-folders`

```bash
npm run typecheck  # 삭제 후 TypeScript 오류 없는지만 확인
```

---

## STEP 9 — 대형 파일 분할

**위험도**: 높음  
**브랜치**: `refactor/step-9-file-split`

**가장 마지막에 실행.** STEP 1~8 완료 후 진행.

**완료 후 검증**:
```bash
npm run typecheck
npm test
npm run smoke
# 사주 계산 전체 플로우 브라우저에서 직접 확인
```

---

## 복구 절차

### 상황별 복구 명령

#### 케이스 1: STEP 작업 중 문제 발생 (브랜치에서 작업 중)
```bash
# 브랜치 버리고 main으로 복귀
git checkout main
git branch -D refactor/step-N-이름
```

#### 케이스 2: main에 병합 후 문제 발견
```bash
# 병합 전 커밋으로 되돌리기 (병합 직후에만 가능)
git revert HEAD --no-commit
git commit -m "revert: step N 롤백"

# 또는 merge commit hash로 정확히 되돌리기
git log --oneline -5  # merge commit hash 확인
git revert <merge-commit-hash> -m 1
```

#### 케이스 3: 여러 STEP 진행 후 처음부터 되돌려야 할 때
```bash
# 안전 태그로 하드 리셋 (⚠ 이후 모든 커밋 삭제됨)
git log --oneline --decorate | grep refactor-start  # 태그 확인
git reset --hard refactor-start-20260509
```

#### 케이스 4: Vercel 배포 후 장애 발생
```bash
# Vercel 대시보드 → Deployments → 직전 배포 → "Redeploy" 클릭
# 또는 CLI:
# vercel rollback
```

---

## 수동 스모크 테스트 체크리스트

각 STEP 후 브라우저에서 아래 플로우를 순서대로 확인:

```
[ ] 홈 화면 로드 — 서비스 카드 표시
[ ] 홈 → 오늘운세 클릭 → 생년월일 입력 → 결과 화면
[ ] 홈 → 사주 카드 클릭 → /saju/new → 주제 선택 → 생년월일 입력 → 결과
[ ] /compatibility → 두 사람 입력 → 결과
[ ] /tarot/daily → 카드 선택 → 결과
[ ] /login → 이메일 입력 → 로그인
[ ] /my → 크레딧 표시 (로그인 후)
[ ] /membership → 멤버십 정보 표시
[ ] /about-engine → /interpretation 으로 이동 (STEP 5 이후)
```

---

## 검증 결과 기록 양식

```
STEP N 완료 일시: YYYY-MM-DD HH:MM
브랜치: refactor/step-N-이름

자동 검증:
  tsc 오류: 0
  유닛 테스트: X/Y 통과
  smoke-test: X/Y 통과
  verify-imports: 통과/실패

수동 확인:
  [ ] 홈
  [ ] 오늘운세
  [ ] 사주 새로 시작
  [ ] 궁합
  [ ] 타로

특이사항:
  (없음)

병합 여부: main에 병합 완료 / 보류 (이유: )
```

---

## 알려진 잠재적 버그 (개선 작업과 별개)

### proxy.ts가 middleware로 동작하지 않음

`src/proxy.ts`는 Next.js middleware 패턴으로 작성되어 있지만,
`src/middleware.ts`가 존재하지 않아 실제로는 아무 동작도 하지 않는다.
내부의 `/dashboard` 경로 auth redirect 로직이 비활성 상태.

**별도 수정 필요**: `src/proxy.ts` → `src/middleware.ts`로 이름 변경 또는
middleware 설정 여부 확인 후 처리.
