# 정책 버전 관리 방식

> Phase 5 구현 대상. 본 문서는 **설계 합의안** 이며, 실제 마이그레이션 / API / UI 는 Phase 5 PR 에서 코드화한다.

작성일: 2026-05-17

---

## 1. 배경

현재 `/terms`, `/privacy` 페이지에 **개정일·버전 표기 없음**. 약관규제법상 약관 변경 사전공지 의무 (변경일 7~30일 전), 정보통신망법 §27 의 개인정보처리방침 변경 통지 의무 이행 불가 상태.

또한 사용자 동의 이력 DB 가 없어 추후 정책 변경 시 누구에게 재동의를 받아야 하는지 식별 불가.

---

## 2. 설계 합의

### 2.1 정책 종류
| 정책 | URL | 의무 동의 | 마케팅 |
|---|---|---|---|
| 이용약관 | `/terms` | 필수 | — |
| 개인정보처리방침 | `/privacy` | 필수 | — |
| 환불정책 | `/refund-policy` | 필수 | — |
| 마케팅 수신 동의 | `/policies/marketing` | 선택 | ✓ |
| 청소년 보호 정책 (선택) | `/policies/youth-protection` | 안내 | — |

### 2.2 버전 식별
- **semver 형식**: `vMAJOR.MINOR.PATCH` 예: `v1.0.0`, `v1.0.1`, `v2.0.0`
- **MAJOR 증가 = 사용자 재동의 의무 발생**: 처리 항목 신설 / 보유기간 변경 / 제3자 제공 추가 등 사용자 권리에 영향
- **MINOR/PATCH**: 표현 정리, 오탈자, 문구 명확화 — 재동의 불요 (변경 공지만)

### 2.3 시행일
- 각 버전은 **시행일(effectiveDate)** 보유. 운영자가 미리 공지 후 시행
- 약관 = 시행일 7일 전 공지 (사용자에게 불리한 변경은 30일 전)
- 개인정보처리방침 = 시행일 7일 전 공지

### 2.4 env 키
[`legal-required-fields.md`](../legal-required-fields.md) §3 참고:
```
POLICY_TERMS_VERSION=v1.0.0
POLICY_TERMS_EFFECTIVE_DATE=2026-XX-XX
POLICY_PRIVACY_VERSION=v1.0.0
POLICY_PRIVACY_EFFECTIVE_DATE=2026-XX-XX
POLICY_REFUND_VERSION=v1.0.0
POLICY_REFUND_EFFECTIVE_DATE=2026-XX-XX
```

---

## 3. DB 스키마 — Phase 5 마이그레이션 안

```sql
-- supabase/migrations/0XX_policy_versions.sql
create table public.policy_versions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('terms','privacy','refund','marketing','youth_protection')),
  version text not null,                  -- 'v1.0.0'
  effective_date date not null,
  content_hash text not null,             -- 해당 시점 정책 본문 SHA-256
  requires_reconsent boolean not null default false,
  changelog text,
  created_at timestamptz not null default now(),
  unique (kind, version)
);

create table public.user_policy_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_version_id uuid not null references public.policy_versions(id),
  consented_at timestamptz not null default now(),
  consent_method text not null check (consent_method in ('signup_implicit','signup_explicit','reconsent_modal','admin_proxy')),
  client_ip inet,
  user_agent text,
  unique (user_id, policy_version_id)
);

create index user_policy_consents_user_idx on public.user_policy_consents(user_id);
create index policy_versions_kind_effective_idx on public.policy_versions(kind, effective_date desc);
```

### 3.1 RLS
- `policy_versions`: SELECT public (모든 사용자가 정책 이력 열람 가능)
- `user_policy_consents`: SELECT own (`user_id = auth.uid()`), INSERT own, UPDATE/DELETE 차단

---

## 4. 적용 흐름

### 4.1 정책 페이지 렌더링
```ts
// src/app/terms/page.tsx (Phase 5 변경 안)
import { getCurrentPolicyVersion } from '@/lib/policies';

export default async function TermsPage() {
  const v = await getCurrentPolicyVersion('terms');
  return (
    <main>
      <header>
        <h1>이용약관 ({v.version})</h1>
        <p>시행일: {formatKoreanDate(v.effectiveDate)}</p>
      </header>
      <section>{/* 본문 */}</section>
      <footer>
        <a href="/policies/terms/history">이전 버전 이력 보기</a>
      </footer>
    </main>
  );
}
```

### 4.2 회원가입 동의 흐름
1. 회원가입 폼에 `TermsConsentModal` 실연결 (현재 미사용 SHELL)
2. 필수/선택 분리 — 약관/방침/환불정책 = 필수, 마케팅 = 선택
3. 동의 시 `user_policy_consents` 에 현재 `policy_versions` 행 ID 와 함께 insert
4. 동의 method = `signup_explicit`

### 4.3 정책 변경 시 재동의
1. 운영자가 `policy_versions` 에 신규 행 insert (`requires_reconsent=true`)
2. 시행일 도래 시 — 로그인 직후 `user_policy_consents` 에 신규 version_id 동의가 없는 사용자에게 재동의 모달 강제 노출
3. 동의 시 새 버전 행 insert (`consent_method='reconsent_modal'`)
4. 거부 시 — 운영 정책에 따라 회원 탈퇴 안내 또는 일부 기능 제한

### 4.4 변경 사전공지
- 시행일 7일 전 (사용자에게 불리한 변경 = 30일 전) 이메일 / 푸시 / 사이트 배너 발송
- 사이트 배너: `policy_versions` 의 미래 시행일 행이 있으면 자동 표시

---

## 5. 정책 본문 파일 관리

- 정책 본문은 `src/app/(public)/legal/{terms,privacy,refund,marketing}/page.tsx` 에 배치 (`src/app/(public)/legal/` 빈 폴더 활용)
- 본문 변경 시 PR 으로 commit 하고, **버전 행을 함께 insert 하는 migration 추가 필수**
- `content_hash` = 본문 SHA-256. 본문 변경 후 버전 행 insert 누락을 CI 에서 검출 가능 (Phase 5 후속 audit)

---

## 6. 추후 검토 사항

- 외부 약관 관리 SaaS (Iubenda 등) 도입 검토 — Phase 6+
- 동의 이력 영구 보관 의무 vs 사용자 삭제권 (GDPR/PIPA) — 익명화 후 보관 검토
- 자동 변경 감지: `content_hash` 비교로 버전 행 누락 감지 (CI audit)

---

## 7. Phase 5 작업 PR 분해 안

| PR | 범위 |
|---|---|
| 5-A | `policy_versions` + `user_policy_consents` 마이그레이션 + RLS + seed v1.0.0 |
| 5-B | `getCurrentPolicyVersion` 유틸 + `/terms`, `/privacy` 페이지 헤더 갱신 |
| 5-C | `/refund-policy` 페이지 신설 + 본문 작성 (운영자 입력값 합산) |
| 5-D | `TermsConsentModal` 실연결 (회원가입 / saju-intake) + `user_policy_consents` insert |
| 5-E | 재동의 모달 (`policy_versions.requires_reconsent`) 시행일 도래 시 자동 노출 |
| 5-F | 사이트 배너 (시행 예정 정책 자동 안내) |
