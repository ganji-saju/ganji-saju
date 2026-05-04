# 간지사주 연결 전수 점검 메모

점검일: 2026-05-05

## 확인 범위

- Next.js App Router 페이지와 API 라우트
- 사주 계산 엔진, 결과 리포트, 오늘운세, 띠운세, 궁합, 타로 연결
- Supabase 마이그레이션과 코드에서 참조하는 테이블/RPC
- OpenAI, KASI, Toss, Web Push, Supabase 운영 환경변수
- 기존 검증 테스트와 현재 쉬운 풀이 방향의 일치 여부

## 바로 수정한 연결

| 영역 | 문제 | 조치 |
| --- | --- | --- |
| 사주 결과 저장 | `SUPABASE_SERVICE_ROLE_KEY`가 없으면 `/api/readings`가 무조건 preview slug로 빠질 수 있었음 | 로그인 사용자는 session client로 자기 `readings` row를 저장/삭제할 수 있게 보강 |
| Supabase RLS | `readings`에는 SELECT 정책만 있고 INSERT/DELETE owner 정책이 없었음 | `019_readings_owner_mutations.sql` 추가 |
| 고전 근거 조회 | `/api/classics/evidence`가 service-role 환경변수에만 묶여 있었음 | service-role이 없으면 public Supabase client로 `search_classic_evidence` RPC를 시도하도록 연결 |
| 프로필 연결 감사 | 띠운세가 아직 약한 개인화로 표시됨 | 실제 사주 엔진의 연주 기준으로 내 띠를 계산한다고 감사 결과 갱신 |
| 검증 테스트 | 예전 전문용어 중심 기대 문구가 남아 전체 테스트가 실패함 | 현재 방향인 쉬운 풀이, 전문용어 본문 분리 기준으로 테스트 갱신 |

## 운영 env 점검 결과

| 항목 | 현재 상태 | 영향 |
| --- | --- | --- |
| Supabase URL/anon/publishable | 있음 | 기본 로그인/공개 DB 연결 가능 |
| `SUPABASE_SERVICE_ROLE_KEY` | production pull 기준 빈 값 | 관리자성 캐시, 일부 검증, 백오피스성 작업 제한 |
| `OPENAI_API_KEY` | 없음 | 연간/평생/대화 AI 해석이 fallback으로 동작 |
| `KASI_SERVICE_KEY` | 없음 | 외부 역법 검증 스냅샷 비활성 |
| Toss 결제 키 | production env 목록에 없음 | 실결제 진입은 별도 키 연결 필요 |
| Web Push 키 | 있음 | 푸시 기능은 키 기준 준비됨 |

## 검증 결과

- `npm run typecheck`: 통과
- `npm run test`: 128개 커스텀 테스트 + 5개 node test 통과
- `npm run build`: 통과
- verification audit 기준:
  - profile linkage: ready, 연결 서비스 5개
  - saju calculation: ready
  - today fortune: ready
  - yearly/lifetime AI: fallback, `OPENAI_API_KEY` 필요
  - KASI live 비교: `KASI_SERVICE_KEY` 필요
  - classics full audit: service-role 필요

## 남은 연결 TODO

1. Supabase production에 migration `019_readings_owner_mutations.sql` 적용
2. Vercel production env에 `OPENAI_API_KEY` 추가
3. Vercel production env에 `KASI_SERVICE_KEY` 추가
4. Toss 실결제 사용 시 `NEXT_PUBLIC_TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY` 추가
5. service-role 기반 운영 검증을 쓰려면 `SUPABASE_SERVICE_ROLE_KEY`에 실제 service role key 추가
6. 고전 코퍼스가 새 Supabase에 실제로 seed 되었는지 service-role로 `classics` audit 재실행
