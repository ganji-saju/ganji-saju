# Report Metadata Contract

간지사주 리포트는 계산 기준과 생성 맥락을 함께 남기기 위해 `metadata` 필드를 optional 구조로 확장합니다.
이번 단계에서는 **타입과 UI 표시 구조만 추가**하며, **DB 마이그레이션은 수행하지 않습니다**.

## 필드 목록

| 필드명 | 타입 | 용도 | 화면 노출 여부 | DB 저장 필요 여부 |
| --- | --- | --- | --- | --- |
| `engineVersion` | `string` | 어떤 엔진 버전으로 계산했는지 추적 | 예 | 예 |
| `ruleSetVersion` | `string` | 격국·용신·운 흐름 규칙셋 버전 추적 | 예 | 예 |
| `tzdataVersion` | `string` | 시간대/DST 기준 버전 추적 | 아니오(추후 선택) | 예 |
| `promptVersion` | `string` | AI 설명 프롬프트 버전 추적 | 선택적 | 예 |
| `llmModel` | `string` | 설명 레이어에 사용한 모델 추적 | 선택적 | 예 |
| `birthInputSnapshot` | `unknown` | 당시 입력값 스냅샷 보관 | 아니오 | 예 |
| `decisionTrace` | `DecisionTraceItem[]` | 판정 순서 요약 표시 및 재현성 보조 | 예 | 예 |
| `generatedAt` | `string` | 리포트 생성 시각 | 선택적 | 예 |

## 화면 연결 기준

- `DecisionTracePanel`
  - `metadata.decisionTrace`를 직접 받아 판정 단계 UI를 렌더링할 수 있습니다.
  - `metadata.engineVersion`, `metadata.ruleSetVersion`은 패널 하단 `리포트 기준 정보`에 표시합니다.
- 실제 결과 화면
  - grounding 기반 실제 데이터를 `metadata.decisionTrace` 형태로 변환해 패널에 전달합니다.
- 샘플 리포트
  - mock `decisionTrace`를 `metadata` 안에 넣어 같은 패널 구조를 재사용합니다.

## 현재 저장 구조 메모

- `SajuPersistedReadingMetadata`
  - reading 결과에 함께 저장되는 메타 구조입니다.
- `SajuReportRuntimeMetadata`
  - 프롬프트/모델/생성 출처까지 포함한 런타임 메타 구조입니다.
- 이번 단계에서는 위 타입들이 공통 `ReportMetadata` 계약을 따르도록 정리했습니다.

## DB 저장 필요 여부

이번 단계에서는 타입만 준비합니다.

추후 DB 단계에서 검토할 항목:

1. `readings.result_json._metadata`와 실제 컬럼 스키마의 역할 분리
2. `engineVersion`, `ruleSetVersion`, `generatedAt`를 top-level column으로 끌어올릴지 여부
3. `decisionTrace`를 JSONB로 저장할지, 별도 audit table로 분리할지 여부
4. `tzdataVersion` 저장 기준 확정
5. PDF 생성 시 메타데이터 표시 범위 확정

## 추후 마이그레이션 TODO

1. 리포트 저장 레코드에 `metadata` 컬럼 계약 반영
2. 연간/평생 리포트 캐시 테이블에 `engineVersion`, `ruleSetVersion`, `promptVersion`, `llmModel` 반영
3. PDF 렌더링 단계에서 `generatedAt`, `engineVersion`, `ruleSetVersion` 표시 규칙 추가
4. Search/QA 도구에서 `decisionTrace` 기준 diff 비교 가능하게 확장
