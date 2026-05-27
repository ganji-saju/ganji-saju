# 설명성 콘텐츠 분리 보관 기록

작업일: 2026-05-06

## 원칙

- 간지사주/간지사주는 “사주를 공부하는 사이트”가 아니라 “오늘 바로 눌러보는 운세 서비스”로 둔다.
- 사용자 흐름에서는 설명, 사용법, 계산 기준, 판단 근거, 고전 원문, 엔진 소개를 앞세우지 않는다.
- 법적 고지, 결제 조건, 건강/의료/위기 안전 문구처럼 운영상 필요한 안내는 제거하지 않는다.

## 화면에서 걷어낸 항목

| 구분 | 기존 노출 위치 | 처리 |
| --- | --- | --- |
| 입력 사용법 카드 | `/saju/new` 하단 빠른 시작 카드 | 제거 |
| 입력 기준 보기 | `/saju/new` 보조 CTA | 제거 |
| 풀이 안내 보기 | `/sample-report` Hero CTA | 제거 |
| 상품/프리미엄 기준 보기 | `/sample-report`, `/compatibility` 보조 CTA | “상품 보기” 또는 제거 |
| 판단 단서 미리보기 | `/sample-report` | 제거 |
| 고전/원전 설명 섹션 | `/sample-report`, 고전 참고 패널 | 화면 노출 축소 |
| 결과 첫 화면 근거 카드 | `/saju/[slug]` 상단 | 제거 |
| 결과 화면 안내성 설명 | `/saju/[slug]` 흐름/CTA 보조 문구 | 삭제 또는 짧은 문장으로 축소 |
| 타로 읽는 방식/사주 연결 설명 | `/tarot/daily/result` | 제거 |
| 별자리 읽는 방식/사주 크로스 설명 | `/star-sign`, `/star-sign/[slug]` | 제거 |
| 궁합 풀이 방식 설명 | `/compatibility` 보조 레일 | 제거 |
| 해석 허브 도움말/계산 기준 CTA | `/interpretation` | 제거 |
| 명리 학습성 설명 | `/myeongri`, `/myeongri/ten-gods` | 축소 및 상세 학습 페이지 리다이렉트 |

## 2차 점검에서 추가로 걷어낸 항목

| 구분 | 기존 노출 위치 | 처리 |
| --- | --- | --- |
| 대화방 이용 방식 카드 | `/dialogue` 하단 | 제거 |
| 대화 원칙/답변 방식 설명 | `/dialogue` 보조 레일 | 제거 |
| 대화 질문 예시 카드 묶음 | `/dialogue` 하단 | 채팅 입력창의 짧은 추천 버튼으로만 유지 |
| 대화창 상단 장문 설명 | `DialogueChatPanel` | “바로 물어보세요” 중심으로 축소 |
| 대화 답변 하단 메타 라벨 | `DialogueChatPanel` 메시지 하단 | 정밀/기본/프로필/코인 상태 설명 제거 |
| 대화창 과금/저장 안내 장문 | `DialogueChatPanel` 입력창 하단 | “처음 3회 무료 · 이후 3회 3코인”으로 축소 |
| 타로 덱 기준/소스 배지 | `/tarot/daily/result` | 제거 |
| 타로 결과 상세 스프레드 예시 | `/tarot/daily/result` 하단 | 제거 |
| 타로 메인 오늘의 카드 미리보기 | `/tarot/daily` | 제거 |
| 타로 결과 구성 설명 | `/tarot/daily` 하단 | 제거 |
| 띠운세 입춘 기준 장문 설명 | `/zodiac`, `/zodiac/[slug]` | CTA와 결과 중심으로 축소 |
| 띠운세 기준/헷갈릴 때 섹션 | `/zodiac` 하단 | 제거 |
| 궁합 입력 사용 흐름 설명 | `/compatibility/input` 관계 렌즈 아래 | 제거 |
| 궁합 필요 데이터 설명 | `/compatibility/input` 하단 | 제거 |
| 저장 정보 불러오기 보조 설명 | `/compatibility/input` 하단 | 상단 빠른 불러오기만 유지 |
| 코인 쓰는 방식/결제 전 기준 설명 | `/credits` 상단 | 상품 카드 중심으로 축소 |
| 코인 해금 예시/멤버십 비교 설명 | `/credits` 하단 | 제거 |
| 프로필 저장 기준 설명 | `/my/profile` | 현재 저장 정보와 수정 폼 중심으로 축소 |
| MY 바로가기 도움말 표현 | `/my` 메뉴 | “문의”로 축소 |
| 결제 완료 이용 방식 설명 | `/membership/complete` | 다음 행동 CTA 중심으로 축소 |

## 설명 전용 라우트 처리

아래 라우트는 사용자 흐름에서 설명 페이지로 남기지 않고 서비스 선택 화면으로 돌린다.

| 라우트 | 이동 위치 |
| --- | --- |
| `/guide` | `/interpretation` |
| `/method` | `/interpretation` |
| `/method/[slug]` | `/interpretation` |
| `/about-engine` | `/interpretation` |
| `/myeongri/ten-gods` | `/myeongri` |

## 유지한 안내

- `/terms`, `/privacy`: 법적 고지라 유지
- 결제/환불/코인 안내: 결제 전 확인이 필요한 내용이라 유지
- `SafetyNotice`: 건강, 법률, 투자, 위기 상황 관련 안전 문구라 유지
- API 내부 프롬프트의 안전/비생성 규칙: 사용자 화면 문구가 아니라 품질/안전 장치라 유지

## 다음 점검 TODO

- 운영 화면에서 `/`, `/saju/new`, `/saju/[slug]`, `/tarot/daily/result`, `/compatibility`, `/pricing` 순서로 실제 문장 밀도를 다시 본다.
- 남은 “기준/근거/고전/엔진” 표현은 결제/법적/내부 검증 화면을 제외하고 추가 제거한다.
