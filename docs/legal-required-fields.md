# 운영자 입력 필요 — 법무 / 사업자 필드

> **원칙**: 본 목록의 값은 **임의 생성 절대 금지**. 운영자가 직접 확인·입력해야 한다. 누락 시 production 빌드 차단 가드를 Phase 5 에서 적용한다.

작성일: 2026-05-17 / 마지막 갱신: 2026-05-17

---

## 1. 분류별 입력 필요 필드

### 1.1 🔴 P0 — 법령상 의무 (production 차단 후보)

| 필드 | 근거 법령 | 현재 상태 | env 키 (Phase 5 신설 예정) | 비고 |
|---|---|---|---|---|
| 통신판매업 신고번호 | 전자상거래법 §13①4호 | **누락** | `BUSINESS_TELESALES_REPORT_NO` | 지자체 신고 후 발급. 형식 예: `제 YYYY-OO구-XXXX호` |
| 상호명 | 전자상거래법 §13 | 푸터 하드코딩 ("푸꼬컴퍼니") | `BUSINESS_NAME` | env 화 필요 |
| 대표자명 | 전자상거래법 §13 | 푸터 하드코딩 ("김재호") | `BUSINESS_CEO_NAME` | env 화 필요 |
| 사업자등록번호 | 전자상거래법 §13 | 푸터 하드코딩 (215-27-64715) | `BUSINESS_REGISTRATION_NO` | env 화 필요 |
| 사업장 주소 | 전자상거래법 §13 | 푸터 하드코딩 | `BUSINESS_ADDRESS` | env 화 필요 |
| 사업장 대표전화 | 전자상거래법 §13 | 푸터 하드코딩 ("010-8123-9184" — 개인 휴대전화) | `BUSINESS_PHONE` | **사업자 대표회선 권장** (010 외) |
| 대표 이메일 | 전자상거래법 §13 | 푸터 미표기 (`support@ganjisaju.kr` 만 contact-form 내부 상수) | `BUSINESS_EMAIL` | 푸터 노출 권장 |
| 개인정보보호책임자(CPO) — 성명 | 개인정보보호법 §31, 시행령 §32 | **누락** | `CPO_NAME` | 대표자 겸직 가능 |
| 개인정보보호책임자(CPO) — 직책 | 개인정보보호법 §31 | **누락** | `CPO_POSITION` | |
| 개인정보보호책임자(CPO) — 이메일 | 개인정보보호법 §31 | **누락** | `CPO_EMAIL` | |
| 개인정보보호책임자(CPO) — 전화 | 개인정보보호법 §31 | **누락** | `CPO_PHONE` | |
| 호스팅 사업자 | 정보통신망법 시행령 | **누락** | `HOSTING_PROVIDERS` (JSON 배열) | Vercel Inc. (미국), Supabase Inc. (미국/EU) 등 |

### 1.2 🟡 P1 — 정책 작성 시 필요 (production 차단 X)

| 필드 | 용도 | 현재 상태 | 입력 형태 |
|---|---|---|---|
| 약관/방침 시행일 | `/terms`, `/privacy` 헤더 표기 | **없음** | YYYY-MM-DD |
| 약관/방침 버전 번호 | 정책 버저닝 — [`policies/policy-versioning.md`](policies/policy-versioning.md) | **없음** | v1.0.0 (semver) |
| 약관/방침 개정 이력 | 변경 사전공지 | **없음** | 각 버전별 changelog |
| 환불 기준 세부 수치 | `/refund-policy` 신설 시 | FAQ "한 번도 열지 않은 경우 7일 이내" 만 | 정확한 일수 / 조건 / 예외 |
| 결제대행사 정식 상호 | 개인정보처리방침 처리위탁 표 | 누락 | 토스페이먼츠 / 카카오페이 등 실제 사용 PG |
| CS 공식 운영시간 | 푸터 + 정책 페이지 | "평일 9~18시" (`/support/contact`, FAQ) — 푸터 미표기 | "평일 09:00 ~ 18:00 (점심 12:00 ~ 13:00 제외)" 등 정확한 형식 |
| 환불 담당자 이메일 | `/refund-policy` 안내 | 없음 (`support@ganjisaju.kr` 통합) | 별도 회선 권장 |
| AI 페르소나 표기 가이드 | `/dialogue/appointment` 의 "경력 18년 · ★ 4.9 (312)" 유지 여부 | 가짜 표기 (P0 제거 예정) | 삭제 시 대체 카피 정의 필요 |
| 마케팅 수신 동의 대상 채널 | 정보통신망법 §50 분리 동의 | 분리 없음 | 이메일 / SMS / 푸시 각 항목별 발송 여부 |
| 청소년 보호 정책 담당자 | 청소년 보호 정책 페이지 (운세 서비스 권장) | 없음 | 성명 + 이메일 |

### 1.3 🟢 P2 — 부가 정보

| 필드 | 용도 |
|---|---|
| 부가통신사업자 신고번호 | 일부 카테고리 (해당 시) |
| 회사 소개 — 설립일 / 대표 분야 / 비전 | `/about` (신설 시) |
| 보도자료 / 미디어킷 연락처 | PR / 외부 협업 |
| 입금계좌 | 환불 시 사용 |

---

## 2. 상담사 / 전문가 정보 (별도 검토 영역)

| 항목 | 현재 상태 | 운영자 결정 사항 |
|---|---|---|
| `src/app/dialogue/appointment/page.tsx:29` — "경력 18년 · ★ 4.9 (312)" | 가짜 하드코딩 | **즉시 제거** (Phase 4) OR 실제 상담사 자격증명 확보 |
| `DALBIT_TEACHERS` 12종 (`src/content/moonlight.ts`) | 12간지 가상 페르소나 (AI 응답용) | 사용자에게 "AI 페르소나임" 명시 필요 |
| 상담사 후기 / 별점 표기 | 없음 (위 1건만 발견) | 향후 실제 데이터 도입 시 출처 명시 의무 |

---

## 3. env 키 신설 안 (Phase 5)

```bash
# .env.example 추가 예정 — 운영자가 실제값 입력. 빈 값 빌드는 production 빌드 가드로 차단.

# 사업자 기본 정보 (전자상거래법 §13)
BUSINESS_NAME=
BUSINESS_CEO_NAME=
BUSINESS_REGISTRATION_NO=
BUSINESS_TELESALES_REPORT_NO=
BUSINESS_ADDRESS=
BUSINESS_PHONE=
BUSINESS_EMAIL=

# 개인정보보호책임자 (개인정보보호법 §31)
CPO_NAME=
CPO_POSITION=
CPO_EMAIL=
CPO_PHONE=

# 호스팅 / 처리위탁 (개인정보처리방침 표 작성용)
HOSTING_PROVIDERS=[]  # JSON 배열, 예: [{"name":"Vercel Inc.","country":"USA"}]
PAYMENT_PROVIDERS=[]  # JSON 배열, 예: [{"name":"토스페이먼츠","purpose":"결제 처리"}]

# CS
CS_OPERATING_HOURS=    # 예: 평일 09:00 ~ 18:00
REFUND_CONTACT_EMAIL=  # 환불 전용 이메일 (없으면 BUSINESS_EMAIL 사용)

# 정책 버전 / 시행일 (Phase 5 정책 버저닝 인프라에서 사용)
POLICY_TERMS_VERSION=
POLICY_TERMS_EFFECTIVE_DATE=
POLICY_PRIVACY_VERSION=
POLICY_PRIVACY_EFFECTIVE_DATE=
POLICY_REFUND_VERSION=
POLICY_REFUND_EFFECTIVE_DATE=
```

---

## 4. 입력 후 적용 흐름 (Phase 5 예정)

1. 운영자가 `.env.local` 및 Vercel production env 에 위 값 입력
2. `src/lib/business-info.ts` (신설) 가 env 를 typed 객체로 export
3. 푸터 / 정책 페이지 / 결제 안내 / contact 모두 이 export 를 참조 (단일 source of truth)
4. `src/lib/env-guard.ts` (신설) 가 production 빌드 시 P0 env 누락 검출 → throw
5. 정책 페이지는 `POLICY_*_VERSION` + `POLICY_*_EFFECTIVE_DATE` 표시. 버전 변경 시 사용자 재동의 (Phase 5 후속)

---

## 4-A. Phase 3-A 진행 상태 (2026-05-18)

✅ **env 키 신설 완료** — `src/lib/business-info.ts` + `src/lib/business-info.test.ts` + `.env.example` 갱신.

production 빌드 가드 활성:
- 필수 env 누락 시 `[business-info] production 빌드 차단` throw
- dev / Vercel preview 는 가드 비활성 (개발 방해 X)

운영자 다음 작업:
1. Vercel 대시보드 → Settings → Environment Variables → Production scope 에 NEXT_PUBLIC_* 11개 입력
2. 입력 후 production redeploy → 가드 통과 → 푸터/`/help` 에 실제값 노출

`.env.example` placeholder 는 빈 값 — Phase 3-A PR 머지 이전에 운영자 입력값 확정 시 PR 내 .env.example placeholder 부분에 실제값 commit (NEXT_PUBLIC_* 는 공개 정보).

---

## 5. 입력 체크리스트 (운영자용)

`- [ ]` 체크 후 `- [x]` 로 변경:

- [ ] 통신판매업 신고번호 발급 완료 + `BUSINESS_TELESALES_REPORT_NO` 입력
- [ ] 개인정보보호책임자 지정 + 4개 필드 (`CPO_NAME/POSITION/EMAIL/PHONE`) 입력
- [ ] 사업자 대표회선 결정 (010 또는 별도) + `BUSINESS_PHONE` 갱신
- [ ] 호스팅 사업자 명단 확정 + `HOSTING_PROVIDERS` JSON 입력
- [ ] 결제대행사 정식 상호 확정 + `PAYMENT_PROVIDERS` JSON 입력
- [ ] 약관 v1.0.0 시행일 결정 + `POLICY_TERMS_*` 입력
- [ ] 개인정보처리방침 v1.0.0 시행일 결정 + `POLICY_PRIVACY_*` 입력
- [ ] 환불정책 v1.0.0 시행일 결정 + `POLICY_REFUND_*` 입력
- [ ] CS 공식 운영시간 확정 + `CS_OPERATING_HOURS` 입력
- [ ] AI 페르소나 "경력 18년 · ★ 4.9 (312)" 처리 방침 결정 (Phase 4 전 필수)
- [ ] 청소년 보호 정책 담당자 지정 (선택)

---

## 6. 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-05-17 | 초기 작성 (Phase 1) |
