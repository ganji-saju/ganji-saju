# 단일 출생정보 입력 허브 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 출생정보를 1회 입력하면 오늘운세·사주를 재입력 없이 볼 수 있게 하고, 사주 입력을 3스텝→1화면으로 합쳐 시니어 사용성을 높인다.

**Architecture:** 공용 `UnifiedIntake` 컴포넌트(입력 1화면 + 접이식 관심주제)를 세 진입점(`/start` 허브·`/saju/new`·`/today-fortune`)이 공유한다. 입력값은 공용 게스트키(`moonlight:birth-profile:last`)+로그인 프로필에 저장돼 상호 자동채움된다. `next` 파라미터로 상품 의도를 전달해, 의도가 있으면 선택화면을 건너뛰고 바로 해당 상품으로 라우팅한다. 밑단 리졸버(`resolveUnifiedBirthInput`)·slug(`toSlug`)는 불변이라 결과 계산 로직은 그대로다.

**Tech Stack:** Next.js 16 App Router(Turbopack), React 19, TypeScript, Supabase. 테스트: 순수 로직=`vitest`(`npm run test:spec`), 타입=`tsc --noEmit`, 빌드=`npm run build`, 핵심 플로우=Playwright(`npm run e2e`).

## Global Constraints

- 밑단 파싱/검증은 `resolveUnifiedBirthInput`(`src/lib/saju/unified-birth-entry.ts`), slug은 `toSlug`(`src/lib/saju/pillars.ts:171`)를 그대로 사용 — 입력 UI만 재배치, 결과 계산 로직 변경 금지.
- 제출 API 불변: 사주=`POST /api/readings`, 오늘운세=`POST /api/today-fortune`.
- 게스트 공용키 신설은 additive — 기존 `moonlight:saju-recent-guest-input-v1`·`moonlight:saju-onboarding-draft`·`/api/profile` 경로를 파괴하지 않는다. 레거시 값은 최초 1회 흡수.
- 이름 필드는 **선택**. 미입력 시 오늘운세 서버 이름 fallback(reading.input에 이름 없음)·사주 별칭 공란 허용 유지.
- `next` 값 화이트리스트: `'today' | 'saju'`. 그 외/누락 → 선택화면(폴백).
- 고정 하단 CTA가 필요하면 `createPortal(document.body)` 사용(조상 transform 회피).
- 결제/페이월 구조·궁합 허브 편입·결과 페이지 리디자인은 **비범위**.
- 커밋은 브랜치에서(main 직접 금지). 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- 응답·주석·문구는 한국어.

---

### Task 1: 공용 출생 프로필 저장소 (`birth-profile-store`)

밑단 저장/변환/레거시 흡수를 담는 순수 모듈. UI 없음 → 완전 단위 테스트 대상.

**Files:**
- Create: `src/features/unified-intake/birth-profile-store.ts`
- Test: `src/features/unified-intake/birth-profile-store.spec.ts`

**Interfaces:**
- Consumes: 기존 타입 `OnboardingFocusTopic`, `OnboardingRelationshipStatus`, `OnboardingOccupation`, `OnboardingConcern`, `SajuOnboardingDraft`, `RECENT_GUEST_INPUT_STORAGE_KEY`, `loadRecentGuestInput`(모두 `@/features/saju-intake/onboarding-storage`); `TodayFortuneBirthPayload`(`@/lib/today-fortune/types`).
- Produces:
  - `interface UnifiedBirthProfile { name; calendarType; year; month; day; hour; unknownBirthTime; gender; birthLocationCode; birthLocationLabel; birthLatitude; birthLongitude; timeRule; solarTimeMode; focusTopic; relationshipStatus; occupation; currentConcern; concernNote }` (필드 타입은 아래 코드 참조)
  - `BIRTH_PROFILE_STORAGE_KEY = 'moonlight:birth-profile:last'`
  - `createEmptyBirthProfile(): UnifiedBirthProfile`
  - `normalizeBirthProfile(parsed: Partial<UnifiedBirthProfile>): UnifiedBirthProfile`
  - `hasCompleteBirthProfile(p: UnifiedBirthProfile): boolean`
  - `loadBirthProfile(): UnifiedBirthProfile | null` (없거나 불완전 시 레거시 흡수 시도 → 그래도 없으면 null)
  - `saveBirthProfile(p: UnifiedBirthProfile): void`
  - `clearBirthProfile(): void`
  - `profileFromSajuDraft(d: SajuOnboardingDraft): UnifiedBirthProfile`
  - `applyProfileToSajuDraft(base: SajuOnboardingDraft, p: UnifiedBirthProfile): SajuOnboardingDraft`
  - `applyProfileToTodayPayload(base: TodayFortuneBirthPayload, p: UnifiedBirthProfile): TodayFortuneBirthPayload`

- [ ] **Step 1: Write the failing test**

`src/features/unified-intake/birth-profile-store.spec.ts`:

> **중요(vitest 환경=node)**: `vitest.config.ts`는 `environment: 'node'`라 `window`가 없다. 저장소는 `typeof window === 'undefined'`면 no-op이므로, 테스트에서 인메모리 `window.localStorage` shim을 심어야 save/load가 실제로 동작한다(jsdom 의존성 추가 금지).

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  BIRTH_PROFILE_STORAGE_KEY,
  createEmptyBirthProfile,
  normalizeBirthProfile,
  hasCompleteBirthProfile,
  loadBirthProfile,
  saveBirthProfile,
  clearBirthProfile,
  applyProfileToSajuDraft,
  applyProfileToTodayPayload,
} from './birth-profile-store';
import {
  createInitialOnboardingDraft,
  RECENT_GUEST_INPUT_STORAGE_KEY,
} from '@/features/saju-intake/onboarding-storage';

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

beforeEach(() => {
  // 저장소 모듈이 window.localStorage 를 읽으므로 node 환경에 shim 주입.
  (globalThis as unknown as { window: { localStorage: MemStorage } }).window = {
    localStorage: new MemStorage(),
  };
});

function completeProfile() {
  return normalizeBirthProfile({
    name: '홍길동',
    year: '1990', month: '3', day: '15',
    hour: '9', unknownBirthTime: false,
    gender: 'male',
    birthLocationCode: 'KR-11', birthLocationLabel: '서울',
    birthLatitude: '37.5', birthLongitude: '127.0',
  });
}

describe('birth-profile-store', () => {
  it('normalize fills defaults and clamps unknowns', () => {
    const p = normalizeBirthProfile({ calendarType: 'bogus' as never, focusTopic: 'nope' as never });
    expect(p.calendarType).toBe('solar');
    expect(p.focusTopic).toBe('today');
    expect(p.name).toBe('');
  });

  it('hasCompleteBirthProfile requires date+gender+location', () => {
    expect(hasCompleteBirthProfile(createEmptyBirthProfile())).toBe(false);
    expect(hasCompleteBirthProfile(completeProfile())).toBe(true);
  });

  it('save then load round-trips a complete profile', () => {
    saveBirthProfile(completeProfile());
    const loaded = loadBirthProfile();
    expect(loaded?.name).toBe('홍길동');
    expect(loaded?.birthLocationCode).toBe('KR-11');
  });

  it('load absorbs legacy saju recent-guest-input when own key missing', () => {
    const legacy = { ...createInitialOnboardingDraft(), year: '1988', month: '6', day: '2', gender: 'female', birthLocationCode: 'KR-26', birthLocationLabel: '부산', nickname: '순이' };
    window.localStorage.setItem(RECENT_GUEST_INPUT_STORAGE_KEY, JSON.stringify(legacy));
    const loaded = loadBirthProfile();
    expect(loaded?.year).toBe('1988');
    expect(loaded?.name).toBe('순이');
    // absorption persists to the new key
    expect(window.localStorage.getItem(BIRTH_PROFILE_STORAGE_KEY)).not.toBeNull();
  });

  it('applyProfileToSajuDraft maps name→nickname and unknown time clears hour', () => {
    const p = normalizeBirthProfile({ ...completeProfile(), unknownBirthTime: true, hour: '' });
    const draft = applyProfileToSajuDraft(createInitialOnboardingDraft(), p);
    expect(draft.nickname).toBe('홍길동');
    expect(draft.hour).toBe('');
  });

  it('applyProfileToTodayPayload carries unknownBirthTime through', () => {
    const base = applyProfileToTodayPayload(
      { concernId: 'general', calendarType: 'solar', timeRule: 'standard', year: '', month: '', day: '', hour: '', minute: '', unknownBirthTime: false, gender: '', birthLocationCode: '', birthLocationLabel: '', birthLatitude: '', birthLongitude: '' },
      completeProfile()
    );
    expect(base.year).toBe('1990');
    expect(base.gender).toBe('male');
  });

  it('clear removes the key', () => {
    saveBirthProfile(completeProfile());
    clearBirthProfile();
    expect(loadBirthProfile()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:spec -- src/features/unified-intake/birth-profile-store.spec.ts`
Expected: FAIL — `Cannot find module './birth-profile-store'`.

- [ ] **Step 3: Write the implementation**

`src/features/unified-intake/birth-profile-store.ts`:

```ts
'use client';

import {
  createInitialOnboardingDraft,
  loadRecentGuestInput,
  type SajuOnboardingDraft,
  type OnboardingFocusTopic,
  type OnboardingRelationshipStatus,
  type OnboardingOccupation,
  type OnboardingConcern,
} from '@/features/saju-intake/onboarding-storage';
import type { TodayFortuneBirthPayload } from '@/lib/today-fortune/types';

export const BIRTH_PROFILE_STORAGE_KEY = 'moonlight:birth-profile:last';

export interface UnifiedBirthProfile {
  name: string;
  calendarType: 'solar' | 'lunar';
  year: string;
  month: string;
  day: string;
  hour: string;
  unknownBirthTime: boolean;
  gender: string;
  birthLocationCode: string;
  birthLocationLabel: string;
  birthLatitude: string;
  birthLongitude: string;
  timeRule: 'standard' | 'trueSolarTime' | 'nightZi' | 'earlyZi';
  solarTimeMode: 'standard' | 'longitude';
  focusTopic: OnboardingFocusTopic;
  relationshipStatus: OnboardingRelationshipStatus;
  occupation: OnboardingOccupation;
  currentConcern: OnboardingConcern;
  concernNote: string;
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');

export function createEmptyBirthProfile(): UnifiedBirthProfile {
  return {
    name: '', calendarType: 'solar', year: '', month: '', day: '', hour: '',
    unknownBirthTime: false, gender: '', birthLocationCode: '', birthLocationLabel: '',
    birthLatitude: '', birthLongitude: '', timeRule: 'standard', solarTimeMode: 'standard',
    focusTopic: 'today', relationshipStatus: '', occupation: '', currentConcern: '', concernNote: '',
  };
}

function normFocus(v: unknown): OnboardingFocusTopic {
  return v === 'love' || v === 'wealth' || v === 'career' || v === 'relationship' ? v : 'today';
}
function normRel(v: unknown): OnboardingRelationshipStatus {
  return v === 'single' || v === 'dating' || v === 'married' || v === 'separated' ? v : '';
}
function normOcc(v: unknown): OnboardingOccupation {
  return v === 'employee' || v === 'self-employed' || v === 'student' || v === 'homemaker' || v === 'job-seeking' || v === 'other' ? v : '';
}
function normConcern(v: unknown): OnboardingConcern {
  return v === 'business' || v === 'romance' || v === 'family' || v === 'health' || v === 'wealth' || v === 'other' ? v : '';
}

export function normalizeBirthProfile(parsed: Partial<UnifiedBirthProfile>): UnifiedBirthProfile {
  return {
    name: str(parsed.name).slice(0, 20),
    calendarType: parsed.calendarType === 'lunar' ? 'lunar' : 'solar',
    year: str(parsed.year), month: str(parsed.month), day: str(parsed.day),
    hour: str(parsed.hour),
    unknownBirthTime: parsed.unknownBirthTime === true || str(parsed.hour) === '',
    gender: parsed.gender === 'male' || parsed.gender === 'female' ? parsed.gender : '',
    birthLocationCode: str(parsed.birthLocationCode),
    birthLocationLabel: str(parsed.birthLocationLabel),
    birthLatitude: str(parsed.birthLatitude), birthLongitude: str(parsed.birthLongitude),
    timeRule:
      parsed.timeRule === 'trueSolarTime' || parsed.timeRule === 'nightZi' || parsed.timeRule === 'earlyZi'
        ? parsed.timeRule : 'standard',
    solarTimeMode: parsed.solarTimeMode === 'longitude' ? 'longitude' : 'standard',
    focusTopic: normFocus(parsed.focusTopic),
    relationshipStatus: normRel(parsed.relationshipStatus),
    occupation: normOcc(parsed.occupation),
    currentConcern: normConcern(parsed.currentConcern),
    concernNote: str(parsed.concernNote).slice(0, 80),
  };
}

export function hasCompleteBirthProfile(p: UnifiedBirthProfile): boolean {
  return Boolean(
    p.year.trim() && p.month.trim() && p.day.trim() &&
    (p.gender === 'male' || p.gender === 'female') &&
    p.birthLocationCode.trim()
  );
}

export function profileFromSajuDraft(d: SajuOnboardingDraft): UnifiedBirthProfile {
  return normalizeBirthProfile({
    name: d.nickname,
    calendarType: d.calendarType, year: d.year, month: d.month, day: d.day, hour: d.hour,
    unknownBirthTime: d.hour === '',
    gender: d.gender, birthLocationCode: d.birthLocationCode, birthLocationLabel: d.birthLocationLabel,
    birthLatitude: d.birthLatitude, birthLongitude: d.birthLongitude,
    timeRule: d.timeRule, solarTimeMode: d.solarTimeMode,
    focusTopic: d.focusTopic, relationshipStatus: d.relationshipStatus,
    occupation: d.occupation, currentConcern: d.currentConcern, concernNote: d.concernNote,
  });
}

export function loadBirthProfile(): UnifiedBirthProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(BIRTH_PROFILE_STORAGE_KEY);
    if (raw) {
      const p = normalizeBirthProfile(JSON.parse(raw) as Partial<UnifiedBirthProfile>);
      if (hasCompleteBirthProfile(p)) return p;
    }
  } catch {
    /* fall through to legacy */
  }
  // 레거시 흡수: 사주 recent-guest-input → 신규 키로 1회 이관.
  const legacy = loadRecentGuestInput();
  if (legacy) {
    const p = profileFromSajuDraft(legacy);
    if (hasCompleteBirthProfile(p)) {
      saveBirthProfile(p);
      return p;
    }
  }
  return null;
}

export function saveBirthProfile(p: UnifiedBirthProfile): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BIRTH_PROFILE_STORAGE_KEY, JSON.stringify(normalizeBirthProfile(p)));
}

export function clearBirthProfile(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(BIRTH_PROFILE_STORAGE_KEY);
}

export function applyProfileToSajuDraft(base: SajuOnboardingDraft, p: UnifiedBirthProfile): SajuOnboardingDraft {
  return {
    ...base,
    nickname: p.name || base.nickname,
    calendarType: p.calendarType, year: p.year, month: p.month, day: p.day,
    hour: p.unknownBirthTime ? '' : p.hour,
    minute: p.unknownBirthTime ? '' : base.minute,
    gender: p.gender, birthLocationCode: p.birthLocationCode, birthLocationLabel: p.birthLocationLabel,
    birthLatitude: p.birthLatitude, birthLongitude: p.birthLongitude,
    timeRule: p.timeRule, solarTimeMode: p.solarTimeMode,
    focusTopic: p.focusTopic, relationshipStatus: p.relationshipStatus,
    occupation: p.occupation, currentConcern: p.currentConcern, concernNote: p.concernNote,
  };
}

export function applyProfileToTodayPayload(base: TodayFortuneBirthPayload, p: UnifiedBirthProfile): TodayFortuneBirthPayload {
  return {
    ...base,
    calendarType: p.calendarType, year: p.year, month: p.month, day: p.day,
    hour: p.unknownBirthTime ? '' : p.hour,
    minute: p.unknownBirthTime ? '' : base.minute,
    unknownBirthTime: p.unknownBirthTime,
    gender: p.gender, birthLocationCode: p.birthLocationCode, birthLocationLabel: p.birthLocationLabel,
    birthLatitude: p.birthLatitude, birthLongitude: p.birthLongitude,
    timeRule: p.timeRule,
  };
}
```

> 실행자 주의: `TodayFortuneBirthPayload`의 실제 필드명을 `src/lib/today-fortune/types.ts`에서 확인해 위 매핑과 정확히 일치시킬 것(특히 `timeRule`/`minute` 존재 여부). 불일치 필드는 스프레드(`...base`)로 보존됨.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm run test:spec -- src/features/unified-intake/birth-profile-store.spec.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `birth-profile-store.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/features/unified-intake/birth-profile-store.ts src/features/unified-intake/birth-profile-store.spec.ts
git commit -m "feat(intake): 공용 출생 프로필 저장소 + 레거시 흡수/변환 어댑터"
```

---

### Task 2: `next` 의도 파서 (`intake-intent`)

상품 의도 파라미터를 화이트리스트로 좁히는 순수 헬퍼.

**Files:**
- Create: `src/features/unified-intake/intake-intent.ts`
- Test: `src/features/unified-intake/intake-intent.spec.ts`

**Interfaces:**
- Produces: `type IntakeIntent = 'today' | 'saju'`; `parseIntakeIntent(value: string | null | undefined): IntakeIntent | null`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { parseIntakeIntent } from './intake-intent';

describe('parseIntakeIntent', () => {
  it('accepts whitelisted values', () => {
    expect(parseIntakeIntent('today')).toBe('today');
    expect(parseIntakeIntent('saju')).toBe('saju');
  });
  it('rejects everything else', () => {
    expect(parseIntakeIntent('compat')).toBeNull();
    expect(parseIntakeIntent('')).toBeNull();
    expect(parseIntakeIntent(null)).toBeNull();
    expect(parseIntakeIntent(undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:spec -- src/features/unified-intake/intake-intent.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
export type IntakeIntent = 'today' | 'saju';

export function parseIntakeIntent(value: string | null | undefined): IntakeIntent | null {
  return value === 'today' || value === 'saju' ? value : null;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm run test:spec -- src/features/unified-intake/intake-intent.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/unified-intake/intake-intent.ts src/features/unified-intake/intake-intent.spec.ts
git commit -m "feat(intake): next 의도 파서(화이트리스트 today|saju)"
```

---

### Task 3: `UnifiedIntake` 입력 컴포넌트 (1화면 + 접이식 관심주제)

세 진입점이 공유하는 입력 화면. 기존 `UnifiedBirthInfoFields`를 전 섹션으로 렌더하고, 상단 이름 필드 + 하단 접이식 관심주제를 붙인다. 제출 시 `UnifiedBirthProfile`을 확정해 저장하고 상위로 넘긴다.

**Files:**
- Create: `src/features/unified-intake/unified-intake.tsx`
- Reference(read first): `src/components/today-fortune/birth-info-stepper.tsx`(위치검색 state·프로필 자동로드 패턴), `src/features/saju-intake/saju-intake-page.tsx:639-677`(`searchBirthLocationCoordinates`)·`:1361-1553`(관심주제 렌더)·`:1191-1207`(시간모름), `src/components/saju/shared/unified-birth-info-fields.tsx`(props 계약).

**Interfaces:**
- Consumes: `UnifiedBirthInfoFields`(props: `draft: UnifiedBirthEntryDraft`, `onChange`, `visibleSections`, `locationLoading`, `locationMessage`, `locationResults`, `onLocationSearch`, `onPresetSelect`, `onLocationResultSelect`); `resolveUnifiedBirthInput`(`@/lib/saju/unified-birth-entry`); Task1 store(`loadBirthProfile`, `saveBirthProfile`, `createEmptyBirthProfile`); `parseIntakeIntent`(Task2).
- Produces:
  - `interface UnifiedIntakeProps { intent: IntakeIntent | null; submitting?: boolean; onResolve: (profile: UnifiedBirthProfile) => void }`
  - `export function UnifiedIntake(props: UnifiedIntakeProps): JSX.Element`
  - 동작: 마운트 시 `loadBirthProfile()`로 프리필(있으면 "○○님 정보로 볼게요 · [정보 바꾸기]" 요약 카드) → 검증 통과 시 `saveBirthProfile` 후 `onResolve(profile)` 호출. CTA 라벨: intent `saju`="사주 풀이 보기", `today`="오늘 운세 보기", null="결과 보기".

- [ ] **Step 1: Read the reference files** — 위 Reference 목록을 읽어 위치검색 state 관리·`UnifiedBirthEntryDraft` 필드·관심주제 chip 컴포넌트·**로그인 프로필 자동로드**(`birth-info-stepper.tsx:111-161`의 `/api/profile` silent 조회 → `applyProfileBirthInfo`) 패턴을 파악한다.

> 프리필 우선순위(마운트 시): (1) 로그인 사용자면 `/api/profile` silent 조회 결과로 채우고, (2) 없으면 게스트 공용키 `loadBirthProfile()`로 채운다. 둘 다 없으면 빈 폼. `/api/profile` 조회·매핑은 `birth-info-stepper.tsx` 구현을 이식(새로 발명 금지).

- [ ] **Step 2: Write the component**

핵심 구조(요지 — 실제 필드/핸들러는 참조 파일의 기존 패턴을 그대로 옮긴다):

```tsx
'use client';

import { useMemo, useState } from 'react';
import { UnifiedBirthInfoFields } from '@/components/saju/shared/unified-birth-info-fields';
import { resolveUnifiedBirthInput, type UnifiedBirthEntryDraft } from '@/lib/saju/unified-birth-entry';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  loadBirthProfile, saveBirthProfile, createEmptyBirthProfile, type UnifiedBirthProfile,
} from './birth-profile-store';
import type { IntakeIntent } from './intake-intent';

export interface UnifiedIntakeProps {
  intent: IntakeIntent | null;
  submitting?: boolean;
  onResolve: (profile: UnifiedBirthProfile) => void;
}

const CTA_LABEL: Record<string, string> = { saju: '사주 풀이 보기', today: '오늘 운세 보기' };

export function UnifiedIntake({ intent, submitting = false, onResolve }: UnifiedIntakeProps) {
  const [profile, setProfile] = useState<UnifiedBirthProfile>(() => loadBirthProfile() ?? createEmptyBirthProfile());
  const [showInterests, setShowInterests] = useState(false);
  const [error, setError] = useState('');
  // 위치검색 state·핸들러는 birth-info-stepper.tsx 패턴을 그대로 이식.
  // UnifiedBirthEntryDraft ↔ profile 매핑: birthDraft 아래.

  const birthDraft: UnifiedBirthEntryDraft = useMemo(() => ({
    calendarType: profile.calendarType, year: profile.year, month: profile.month, day: profile.day,
    hour: profile.unknownBirthTime ? '' : profile.hour, minute: '',
    unknownBirthTime: profile.unknownBirthTime, gender: profile.gender,
    birthLocationCode: profile.birthLocationCode, birthLocationLabel: profile.birthLocationLabel,
    birthLatitude: profile.birthLatitude, birthLongitude: profile.birthLongitude,
    timeRule: profile.timeRule, solarTimeMode: profile.solarTimeMode,
  }), [profile]);

  function patchBirth(patch: Partial<UnifiedBirthEntryDraft>) {
    setProfile((cur) => ({
      ...cur,
      ...('hour' in patch ? { hour: patch.hour ?? '' } : {}),
      ...('unknownBirthTime' in patch ? { unknownBirthTime: Boolean(patch.unknownBirthTime) } : {}),
      // 나머지 매핑 필드 동일 패턴으로 반영
      ...(patch as Partial<UnifiedBirthProfile>),
    }));
  }

  function handleSubmit() {
    const resolved = resolveUnifiedBirthInput(birthDraft);
    if (!resolved.ok) { setError(resolved.message ?? '입력을 확인해 주세요.'); return; }
    saveBirthProfile(profile);
    onResolve(profile);
  }

  return (
    <div>
      <label>이름(선택)
        <Input value={profile.name} maxLength={20}
          onChange={(e) => setProfile((c) => ({ ...c, name: e.target.value }))} />
      </label>

      <UnifiedBirthInfoFields
        draft={birthDraft}
        onChange={patchBirth}
        visibleSections={['date', 'gender', 'location-time']}
        /* location* props: birth-info-stepper.tsx 의 검색 state/핸들러 이식 */
        locationLoading={/* ... */ false}
        locationMessage={/* ... */ ''}
        locationResults={/* ... */ []}
        onLocationSearch={/* ... */ () => {}}
        onPresetSelect={(code) => setProfile((c) => ({ ...c, birthLocationCode: code }))}
        onLocationResultSelect={/* ... */ () => {}}
      />

      <button type="button" onClick={() => setShowInterests((v) => !v)}>
        ▸ 관심 주제·상황 (선택)
      </button>
      {showInterests && (
        <div>{/* saju-intake-page.tsx:1361-1553 관심주제 chip 을 profile 필드에 바인딩해 이식 */}</div>
      )}

      {error && <p role="alert">{error}</p>}
      <Button onClick={handleSubmit} disabled={submitting}>
        {intent ? CTA_LABEL[intent] : '결과 보기'}
      </Button>
    </div>
  );
}
```

> 실행자 주의: 위치검색(`searchBirthLocationCoordinates`)·프리셋·결과선택 핸들러는 `birth-info-stepper.tsx`에 이미 완성돼 있으니 **그 구현을 그대로 이식**한다(새로 발명 금지). 관심주제 chip은 `saju-intake-page.tsx:1361-1553`의 마크업/`SelectableChip`을 재사용해 `profile.focusTopic/relationshipStatus/occupation/currentConcern/concernNote`에 바인딩.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual smoke via build**

Run: `npm run build`
Expected: 빌드 성공(컴포넌트가 어느 페이지에도 아직 연결 안 됐어도 컴파일 통과).

- [ ] **Step 5: Commit**

```bash
git add src/features/unified-intake/unified-intake.tsx
git commit -m "feat(intake): UnifiedIntake 입력 1화면(이름+생년월일+접이식 관심주제)"
```

---

### Task 4: `/start` 허브 라우트 + 선택화면

의도 없는 진입. 입력 완료 → 선택화면 `[오늘의 운세] [내 사주]`. 각 카드 클릭 시 해당 상품 제출/라우팅.

**Files:**
- Create: `src/app/start/page.tsx`
- Create: `src/features/unified-intake/intake-choice.tsx`
- Reference: 제출 로직 — 사주 `saju-intake-page.tsx:793-954`(POST `/api/readings` → `/saju/{id}?from=saju-new&topic=`), 오늘운세 `today-fortune-experience.tsx:151-217`(POST `/api/today-fortune` → `/today-fortune/result?...`).

**Interfaces:**
- Consumes: `UnifiedIntake`(Task3), `applyProfileToSajuDraft`/`applyProfileToTodayPayload`(Task1).
- Produces: `IntakeChoice`({ profile, onPick }) — `onPick('today'|'saju')`가 상위 제출 함수 호출.

- [ ] **Step 1: Write `intake-choice.tsx`** — 두 개의 큰 카드 버튼(시니어 UI: 큰 타깃). `onPick(intent)` 콜백.

```tsx
'use client';
import type { UnifiedBirthProfile } from './birth-profile-store';
import type { IntakeIntent } from './intake-intent';

export function IntakeChoice({ onPick }: { profile: UnifiedBirthProfile; onPick: (i: IntakeIntent) => void }) {
  return (
    <div role="group" aria-label="무엇을 볼까요?">
      <button type="button" onClick={() => onPick('today')}>오늘의 운세</button>
      <button type="button" onClick={() => onPick('saju')}>내 사주</button>
    </div>
  );
}
```

- [ ] **Step 2: Write `/start` page** — 클라이언트 컴포넌트로 UnifiedIntake(intent=null) 렌더 → resolve 시 choice 표시 → pick 시 해당 제출.

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UnifiedIntake } from '@/features/unified-intake/unified-intake';
import { IntakeChoice } from '@/features/unified-intake/intake-choice';
import type { UnifiedBirthProfile } from '@/features/unified-intake/birth-profile-store';
import type { IntakeIntent } from '@/features/unified-intake/intake-intent';
import { submitSajuFromProfile } from '@/features/unified-intake/submit-saju';
import { submitTodayFromProfile } from '@/features/unified-intake/submit-today';

export default function StartPage() {
  const router = useRouter();
  const [resolved, setResolved] = useState<UnifiedBirthProfile | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(intent: IntakeIntent) {
    if (!resolved || busy) return;
    setBusy(true);
    const href = intent === 'saju'
      ? await submitSajuFromProfile(resolved)
      : await submitTodayFromProfile(resolved);
    router.push(href);
  }

  return resolved
    ? <IntakeChoice profile={resolved} onPick={pick} />
    : <UnifiedIntake intent={null} onResolve={setResolved} />;
}
```

> 이 태스크는 제출 로직을 공용 함수 `submitSajuFromProfile`/`submitTodayFromProfile`로 추출해야 한다(다음 Step). 두 함수는 기존 experience의 제출부를 프로필 입력 버전으로 옮긴 것.

- [ ] **Step 3: Extract submit helpers**
- Create `src/features/unified-intake/submit-saju.ts`: `applyProfileToSajuDraft`로 draft 구성 → `resolveUnifiedBirthInput` → `POST /api/readings`(기존 body 계약) → 성공 시 `/saju/{id}?from=start&topic=${profile.focusTopic}` 반환, 실패 시 `toSlug` fallback href. (기존 `saju-intake-page.tsx:793-954` 로직 이식; `from` 값만 `start`.) **로그인 프로필 자동저장 유지**: 제출 성공 시 기존 `shouldAutoSavePersonalProfile` 규칙대로 `POST /api/profile` 갱신(`saju-intake-page.tsx:867-888` 이식). 게스트는 `saveBirthProfile(profile)`로 공용키 갱신(UnifiedIntake가 이미 저장하나 제출 시점 재확정).
- Create `src/features/unified-intake/submit-today.ts`: `applyProfileToTodayPayload`로 payload 구성 → `POST /api/today-fortune` → sessionStorage/localStorage 저장(기존 `today-fortune-experience.tsx:181-185` 패턴) → `/today-fortune/result?sourceSessionId=...&concern=general` 반환.

> 실행자 주의: 두 헬퍼는 기존 제출부를 **복제가 아니라 이식**해야 한다. Task5·6에서 기존 experience들도 이 헬퍼를 호출하도록 바꿔 중복을 제거한다(아래).

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: 성공. `/start` 라우트가 빌드 산출물에 포함.

- [ ] **Step 5: Commit**

```bash
git add src/app/start/page.tsx src/features/unified-intake/intake-choice.tsx src/features/unified-intake/submit-saju.ts src/features/unified-intake/submit-today.ts
git commit -m "feat(intake): /start 허브 + 선택화면 + 상품별 제출 헬퍼"
```

---

### Task 5: 사주 진입(`/saju/new`)을 UnifiedIntake로 교체

3스텝 스와이프 위저드 → UnifiedIntake(intent=saju) 1화면. 제출은 Task4의 `submitSajuFromProfile` 사용.

**Files:**
- Modify: `src/app/saju/new/page.tsx`(엔트리) — `SajuIntakePage` 대신 UnifiedIntake 기반 클라이언트 렌더로 교체.
- Modify/Deprecate: `src/features/saju-intake/saju-intake-page.tsx` — 스텝 위저드 제거. **주의**: 이 파일은 1713줄 단일 파일. 위저드 골격(activeIndex/스와이프/progress/BASE_STEPS)을 걷어내고, 이식 못 한 재사용 조각(관심주제 chip 등)은 Task3에서 이미 옮겼으므로 제거. 남는 것이 없으면 파일 삭제하고 진입 page가 UnifiedIntake를 직접 렌더.
- Reference: `docs/superpowers/specs/2026-07-10-unified-birth-intake-hub-design.md` 입력 화면 구성.

**Interfaces:**
- Consumes: `UnifiedIntake`, `submitSajuFromProfile`.

- [ ] **Step 1: Rewrite `/saju/new` entry** — intent='saju'로 UnifiedIntake 렌더, `onResolve`에서 `submitSajuFromProfile(profile)` → `router.push`.

```tsx
'use client';
import { useRouter } from 'next/navigation';
import { UnifiedIntake } from '@/features/unified-intake/unified-intake';
import { submitSajuFromProfile } from '@/features/unified-intake/submit-saju';

export default function SajuNewClient() {
  const router = useRouter();
  return (
    <UnifiedIntake intent="saju" onResolve={async (p) => router.push(await submitSajuFromProfile(p))} />
  );
}
```

> `src/app/saju/new/page.tsx`가 서버 컴포넌트면 위를 별도 `*-client.tsx`로 두고 page에서 렌더. 기존 `SajuIntakePage step="birth"` 호출부 제거.

- [ ] **Step 2: Remove wizard scaffolding** — `saju-intake-page.tsx`에서 스와이프/스텝/progress 제거. 옛 다중 URL 껍데기(`empathy/consent/birth/nickname/page.tsx`)는 이미 redirect라 유지(변경 불필요). 동의(consent) 처리가 제출에 필요하면 UnifiedIntake 제출 경로로 이동(기존 `saveAcceptedRequiredConsents` 흐름 확인).

- [ ] **Step 3: Verify existing saju logic tests still pass**

Run: `npm run test:spec && npm test`
Expected: 기존 사주 엔진/픽스처 테스트 PASS(입력 UI 교체가 계산에 영향 없음).

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: 성공. 죽은 import 없음.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(saju): /saju/new 3스텝→UnifiedIntake 1화면 교체, 위저드 골격 제거"
```

---

### Task 6: 오늘운세 진입(`/today-fortune`)을 UnifiedIntake로 교체

`BirthInfoStepper` 폼 부분을 UnifiedIntake(intent='today')로 교체하고, 고민(concern) 선택은 유지. 제출은 `submitTodayFromProfile` 사용.

**Files:**
- Modify: `src/features/today-fortune/today-fortune-experience.tsx` — `BirthInfoStepper` 렌더부(:312 부근)와 `handleSubmit`을 UnifiedIntake + `submitTodayFromProfile`로 교체. `TodayConcernSelector`는 유지(오늘운세 고유).
- Reference: 기존 `handleSubmit`(:151-217), draft(:35-107).

**Interfaces:**
- Consumes: `UnifiedIntake`, `submitTodayFromProfile`. concernId는 UnifiedIntake 밖(상단 고민 선택)에서 관리해 제출 시 payload에 주입.

- [ ] **Step 1: Wire concern + UnifiedIntake** — 상단 `TodayConcernSelector` 유지, 하단을 UnifiedIntake로. `onResolve(profile)`에서 `submitTodayFromProfile(profile, { concernId })` 호출하도록 헬퍼 시그니처 확장(옵션 인자).

- [ ] **Step 2: Extend `submit-today.ts`** — `submitTodayFromProfile(profile, opts?: { concernId?: string })` — concernId 기본 'general'.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run build && npm run test:spec`
Expected: 성공. `today-fortune` 관련 로직 테스트 PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(today): 오늘운세 입력을 UnifiedIntake로 통합(고민선택 유지)"
```

---

### Task 7: 결과 화면 크로스링크

각 결과 하단에 "이 정보로 ○○도 보기" — 공용 프로필로 재입력 없이 다른 상품 진입.

**Files:**
- Modify: `src/app/today-fortune/result/*`(결과 뷰) — 하단에 `→ 이 정보로 내 사주 보기` 링크(`/saju/new`; 공용키로 프리필됨).
- Modify: `src/app/saju/[slug]/page.tsx` 또는 사주 결과 뷰 — 하단에 `→ 이 정보로 오늘의 운세 보기` 링크(`/today-fortune`).
- Reference: 두 결과 페이지의 기존 하단 CTA 영역.

**Interfaces:**
- Consumes: 없음(단순 링크). 대상 페이지가 마운트 시 `loadBirthProfile()`로 프리필(Task3에서 UnifiedIntake가 이미 수행).

- [ ] **Step 1: Add cross-link to today result** — 사주로 가는 링크(큰 버튼, 시니어 UI). 링크 href `/saju/new`.
- [ ] **Step 2: Add cross-link to saju result** — 오늘운세로 가는 링크 href `/today-fortune`.
- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: 성공.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(intake): 결과 화면 상호 크로스링크(재입력 없이 상품 전환)"
```

---

### Task 8: 진입점 `next` 의도 전달 + 홈 허브 CTA

기존 상품 링크가 의도를 잃지 않게 하고, 홈 대표 CTA를 `/start`로.

**Files:**
- Modify: `src/features/shared-navigation/mega-nav-data.ts`(+ `mega-nav.tsx`/`mobile-nav-sheet.tsx`) — 사주/오늘운세 진입 링크가 각각 `/saju/new`·`/today-fortune`(의도 내장)로 이미 향하는지 확인, 아니면 정정.
- Modify: 홈 대표 CTA(랜딩/`src/features/home/*`) — "지금 시작" 대표 버튼을 `/start`로.
- Modify(선택): SEO 퍼널 그리드(`src/components/seo/paid-funnel-grid.tsx`) 링크에 상품 의도 유지.

**Interfaces:**
- Consumes: 라우트만. `/start?next=saju` 형태로 특정 상품 선지정도 가능(선택화면 스킵).

- [ ] **Step 1: Audit entry links** — `grep -rn "/saju/new\|/today-fortune" src` 로 진입 링크 인벤토리. 상품 의도가 명확한 링크는 해당 상품 라우트 유지(스킵), 애매한 "운세 시작류"는 `/start`.
- [ ] **Step 2: Point home hero CTA to `/start`.**
- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: 성공. 링크 404 없음.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(nav): 홈 대표 CTA→/start, 진입점 상품 의도 보존"
```

---

### Task 9: 핵심 플로우 E2E (Playwright)

허브 1회 입력 → 선택 → 상품 진입, 그리고 재입력 스킵을 회귀로 고정.

**Files:**
- Create: `e2e/unified-intake.spec.ts`
- Reference: 기존 `e2e/*.spec.ts` 패턴(셀렉터·baseURL).

- [ ] **Step 1: Write e2e** — (1) `/start` 방문 → 생년월일·성별·출생지 입력 → "결과 보기" → 선택화면 노출 확인. (2) "내 사주" 클릭 → `/saju/**` 도달. (3) 이후 `/today-fortune` 방문 시 출생정보가 프리필("정보 바꾸기" 요약 카드 노출)됨을 확인.

```ts
import { test, expect } from '@playwright/test';

test('start hub: 1회 입력 → 선택 → 사주, 이후 오늘운세 프리필', async ({ page }) => {
  await page.goto('/start');
  // 생년월일·성별·출생지 입력 (실제 셀렉터는 UnifiedIntake 구현에 맞춤)
  // ... fill date/gender/location ...
  await page.getByRole('button', { name: '결과 보기' }).click();
  await expect(page.getByRole('group', { name: '무엇을 볼까요?' })).toBeVisible();
  await page.getByRole('button', { name: '내 사주' }).click();
  await expect(page).toHaveURL(/\/saju\//);

  await page.goto('/today-fortune');
  await expect(page.getByText('정보로 볼게요')).toBeVisible();
});
```

- [ ] **Step 2: Run e2e**

Run: `npm run e2e -- unified-intake`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/unified-intake.spec.ts
git commit -m "test(intake): 허브 1회 입력→선택→상품 + 프리필 e2e"
```

---

## 실행 순서/의존성
Task 1·2(순수, 병렬 가능) → 3(1·2 의존) → 4(3 의존) → 5·6(4 의존) → 7·8(5·6 의존) → 9(전체 통합). 위저드 제거(5)는 관심주제 이식(3) 완료 확인 후 진행.
