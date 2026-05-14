# 사주 엔진 KASI 비교 audit — 2026-05-15

> P1 권고 (`audit-reports/2026-05-15-handoff-implementation-audit.md` §3.E + saju 정확도 audit) 후속.
> KASI(한국천문연구원) 음양력 API service key 부재 상태에서 **실측 비교는 후속**으로 분리.
> 본 문서는 **로컬 산식 결과(lunar-typescript 기반)** 6 sample 의 출력을 정리해 추후 KASI 실측이 가능해질 때 비교 기준선으로 활용.

## 1. KASI service key 상태

`process.env.KASI_SERVICE_KEY` 미설정 (확인: 2026-05-15).

> **다음 단계 (별도 PR)**:
> 1. KASI 회원 가입 → 음양력 API service key 발급
> 2. Vercel env `KASI_SERVICE_KEY` 추가
> 3. `runKasiCalendarValidation()` 실행 후 issues[] 출력 → 본 md 갱신

## 2. 6 fixture sample 로컬 산식 결과

`src/domain/saju/validation/kasi-calendar.ts:56` 의 `KASI_COMPARISON_SAMPLES` 6건.
산출 함수: `buildLocalCalendarComparable(input)` (같은 파일).

| ID | 라벨 | 입력 (yyyy-mm-dd HH:MM) | 비교 항목 | 비고 |
|---|---|---|---|---|
| `regular-docs-era` | 일반 양력일 | 2015-09-22 12:00 | 음력 + 일주 | 기본 변환 stability 베이스라인 |
| `solar-leap-day` | 양력 윤일 | 2024-02-29 12:00 | 음력 + 일주 | leap day 처리 |
| `lunar-new-year-boundary` | 설날 경계 | 2024-02-10 12:00 | 음력 + 일주 | 음력 해 바뀌는 경계 |
| `lunar-leap-month-start` | 윤달 시작권 | 2023-03-22 12:00 | 음력 + 일주 | 평/윤달 판정 |
| `ipchun-adjacent-before` | 입춘 인접 전날 | 2024-02-03 12:00 | 음력 + 일주 | 절입 경계 안정성 |
| `jasi-boundary-reference` | 자시 경계 참고 | 1982-01-29 23:30 (split) | 음력만 | KASI 는 시각 단위 비교 X — 음력일만 확인 |

각 sample 은 `compareKasiWithLocalSample(sample, kasiResponse)` 호출 시 다음 4 필드를 issue 검증:
- `lunarYear` / `lunarMonth` / `lunarDay`
- `lunarLeapMonth` ('윤' boolean)
- `dayPillar` (일진 ganzi)

## 3. 핵심 정확성 신호 (로컬 단독)

KASI 실측 부재 상태에서 다음 회귀 가드는 이미 작동:

### A. fixture-19820129 spec
`src/domain/saju/engine/__tests__/fixture-19820129.spec.ts` — 1982-01-29 08:45 명식 의 8자 + 십성 + 강약 + 격국 + 용신 기준값 핀.

### B. cross-fixtures spec
`src/domain/saju/engine/__tests__/saju-cross-fixtures.spec.ts` — 3 명식(1982·1977·1995) cross 정합성 검증.

### C. 추가 회귀 (이번 사이클)
- `calculatePattern exposes multi-rank candidates with tougchul / supporting fields (P1)` — PR #76
- today-fortune 14건 spec — 매일 다른 결과 보장 (PR #72·73·74·75·76·77)

## 4. 산식이 흔들릴 가능성이 큰 경계

향후 KASI 실측 가능해질 때 우선 확인할 경계 케이스:

| 경계 | 우려 |
|---|---|
| 자시 23:30~01:30 split/unified | `jasiMethod` 옵션에 따라 일주가 하루 이동. 1982-01-29 sample 이 sentinel |
| 절입 전후 ±2시간 | 월주 변환 시점 — 절기 시각 정확도 의존 |
| 양력 윤일 + 음력 윤달 동시 | 2024-02-29 + 2023 윤2월 케이스 |
| 시간 미상(unknownTime) | hour=12 fallback 처리 |
| 진태양시(trueSolarTime) + 출생지 longitude | EoT(균시차) 보정 미적용 — 분 단위 미세 차이 |

## 5. 진태양시 EoT 보정 (별도 후속)

현재 `trueSolarTime` 옵션은 출생지 longitude(경도) 보정만 적용. **균시차(Equation of Time)** — 지구 공전 궤도 이심률 + 자전축 기울기로 인한 ±16분 변동 — 은 미적용.

영향:
- 분 단위 정확도 필요한 케이스 (자시 경계 부근) 에서 ±15분 오차 가능
- 일반 명식 산출(년/월/일/시주) 에는 영향 거의 없음 (시주는 2시간 단위)

후속 PR (별도):
1. Solar/Lunar 라이브러리의 EoT 함수 확인 (lunar-typescript 자체 지원 여부)
2. 미지원 시 `astronomy-engine` 또는 자체 EoT 다항식 구현
3. trueSolarTime 옵션 활성 + birthLocation 보유 시에만 적용
4. fixture spec 으로 회귀 가드

## 6. 결론 / GO/NO-GO

- ✅ 로컬 산식: lunar-typescript 기반으로 표준적 동작 — KASI 실측 부재 상태에서도 fixture spec 으로 핀 됨
- ⚠️ KASI 실측 비교: service key 발급 후 후속 PR 에서 실행 필요
- ⚠️ EoT 보정: 별도 후속 PR (정확도 미세 개선, 운영 차단 사유는 아님)

P1 audit 권고의 "KASI 비교 6 sample 실측 → audit md 갱신" 항목은 service key 발급 시점에 다시 실행. 본 문서는 그 전 단계의 baseline.
