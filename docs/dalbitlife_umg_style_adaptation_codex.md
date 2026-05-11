# 달빛인생 UMG 스타일 적용 기획서 & Codex 작업 지시서

## 0. 목적

달빛인생을 `990원 운세 카드몰` 인상에서 벗어나, UMG/음양관이 주는 **고급 운세 커머스 + 결과 보관형 리포트 + 강한 구매 신뢰** 구조로 재설계한다.

단, UMG의 시각적·문구적 표현을 복제하지 않는다. 적용 대상은 **전환 구조, 신뢰 장치, 카피 밀도, 모바일 카드 UX, 결과 자산화 방식**이다.

---

## 1. UMG에서 가져올 핵심 DNA

| DNA | UMG식 작동 방식 | 달빛인생 적용 방향 |
|---|---|---|
| 권위 부여 | `대한민국 NO.1`, `조선시대 왕들의 운명을 결정한 관직`처럼 출처와 세계관을 전면화 | `고전 명리 근거 + 현대적 판단 요약`을 브랜드 권위로 사용 |
| 기술 신뢰 | 합·충·형·파·해·원진·공망·지장간·월령 등 계산 요소를 노출 | `원국·오행·십신·합충·용신·대운·세운`을 근거 칩으로 노출 |
| 상품 고급화 | 백년사주, 일품 재물사주, 신년사주처럼 이름이 강함 | `오늘 1분판`, `올해 전략서`, `돈 흐름 점검서`, `관계 패턴서`, `대운 로드맵` |
| 구매 신뢰 | 별점, 구매 수, 구매 인증 리뷰, 할인 앵커 | 실데이터 기반 리뷰만 노출. 초기에는 `샘플 리포트`, `근거 보기`, `저장 가능` 중심 |
| 결과 자산화 | 로그인하면 결과 다시보기, 기록성 강조 | MY 보관함과 PDF 소장 CTA를 결과 페이지 초반에 고정 |
| 모바일 전환 | 카드형 상품, 큰 가격/할인/CTA, 짧은 훅 | 홈·결과·MY를 모바일 카드 중심으로 재구성 |

---

## 2. 현재 달빛인생 문제

### 문제 인식

현재 공개 홈은 다음 인상이 강하다.

- `사주 990원`, `궁합 990원`, `대운 990원` 중심의 저가 상품몰
- `猫`, `잘 풀리는 하루`, `용하다고 소문난`, `궁합도 잘봐요` 등 가벼운 카피
- 사주아이/유어사주류와 유사한 저가 운세 서비스 포지션
- 달빛인생만의 권위, 결과 자산성, 프리미엄 감각이 약함

### 원인 분석

- 홈 첫 화면이 `질문 해결`이 아니라 `상품 진열`로 시작함
- 가격이 먼저 보이고, 해석 품질/근거/보관 가치가 뒤에 보임
- 결과 페이지와 MY 보관함이 브랜드 핵심 가치로 전면화되지 않음
- 카피가 짧기는 하나, 강한 판정형 문장이 아니라 평범한 운세몰 문장임

### 개선 방향

- 홈의 첫 목적을 `구매`가 아니라 `오늘의 질문 선택`으로 변경
- 상품명은 가격 중심이 아니라 문제 해결 중심으로 변경
- 결과는 `운세 읽기`가 아니라 `내 선택 기준서`로 포지셔닝
- UMG식 신뢰 장치를 달빛인생식으로 재해석: `근거`, `저장`, `다시보기`, `고전`, `공포성 단정 없음`

---

## 3. 브랜드 포지션 변경

### Before

> 990원으로 사주, 궁합, 대운, 오늘운을 보는 운세 사이트

### After

> 오늘의 선택을 사주 근거로 짧게 정리하고, 결과를 오래 보관하는 달빛 리포트

### 핵심 문장

```text
오늘의 선택, 길게 묻지 말고 짧게 정리하세요.

사주는 겁주는 말이 아니라 선택의 기준입니다.
질문을 고르면 한 줄 판정, 조심할 패턴, 오늘 할 행동부터 보여드립니다.
```

### 보조 문장

```text
원국·오행·십신·합충·대운 흐름을 바탕으로
지금 필요한 판단만 먼저 압축합니다.
```

---

## 4. 홈 UI 개편안

### 4.1 Hero

#### 목표

UMG의 고급감은 가져오되, 달빛인생은 더 현대적이고 간결하게 간다.

#### 구조

```text
[상단 배지]
달빛인생 · 오늘의 사주 리포트

[헤드라인]
오늘의 선택,
한 줄로 정리하세요.

[서브]
원국·오행·십신·합충을 바탕으로
지금 조심할 패턴과 바로 할 행동을 짧게 보여드립니다.

[CTA]
지금 고민 고르기
오늘 1분 운세 보기

[신뢰 바]
저장 가능 · 다시보기 가능 · 근거 펼침 · 공포성 단정 없음
```

#### Codex 작업

- `src/app/page.tsx` Hero 문구 교체
- `猫`, `990원`, `용하다고`, `궁합도 잘봐요`, `비법 택일` 제거
- Hero 하단에 `ProofBar` 컴포넌트 추가

---

### 4.2 질문형 진입 카드

#### 기존

```text
사주 990원
궁합 990원
대운 990원
택일 준비중
```

#### 변경

```text
돈은 어디서 새고 있을까?
연락해도 될까?
지금 옮길까, 버틸까?
가족과 왜 또 부딪힐까?
올해 판을 바꿔도 될까?
오늘 무엇을 조심해야 할까?
```

#### 카드 구조

```text
[카테고리 배지] 재물
[질문] 돈은 어디서 새고 있을까?
[한 줄 설명] 버는 방식보다 새는 지점을 먼저 잡습니다.
[근거 칩] 재성 · 오행 균형 · 세운
[CTA] 이 질문으로 보기
```

#### Codex 작업

- `QUESTION_ENTRY_POINTS`의 `question`, `reportAnswer`를 punch copy 방식으로 교체
- `ProductGrid` 카드를 `QuestionEntryCard`로 분리
- 가격 노출은 홈 첫 화면에서 제거하고 `/pricing` 또는 결과 후 CTA에서만 노출

---

### 4.3 미리보기 결과 카드

#### 목표

UMG의 `오늘의 한마디`, `점수`, `키워드` 구조를 달빛인생식으로 변환한다.

#### 구조

```text
오늘의 판정
72점 · 키워드: 조율

밀어붙이면 손해, 확인하면 이익.

왜?
금 기운이 강해 말이 날카로워지기 쉽습니다.

조심
같은 말을 반복하면 관계의 온도가 떨어집니다.

오늘 할 행동
중요한 연락은 한 번 적고 보내세요.
```

#### Codex 작업

- `src/components/home/mini-result-preview.tsx` 추가
- 홈 중간에 `MiniResultPreview` 삽입
- 결과 페이지의 `ReportOneMinuteSummary`와 동일한 데이터 구조 사용

---

### 4.4 프리미엄 리포트 카드

#### 목표

UMG의 상품 카드 전환력을 참고하되, 허위 할인·허위 리뷰 없이 간다.

#### 카드명

| 기존 | 변경 |
|---|---|
| 사주 990원 | 오늘 1분 리포트 |
| 궁합 990원 | 관계 패턴 리포트 |
| 대운 990원 | 대운 로드맵 |
| 택일 | 날짜 선택 리포트 |
| 타로 무료 | 오늘 마음 카드 |
| 상담 무료 시작 | 결과 기반 대화 |

#### 카드 구조

```text
[리포트 유형] 올해 전략서
올해 밀어도 되는 달, 멈춰야 할 달

대운·세운·월운을 함께 보고
좋은 달 / 확인할 달 / 정리할 달로 나눕니다.

포함: 1년 흐름 · 월별 전략 · PDF 보관
[CTA] 샘플 보기
```

#### Codex 작업

- `src/content/moonlight.ts`에 `PREMIUM_REPORT_PRODUCTS` 추가
- `src/components/report/premium-report-card.tsx` 추가
- 홈에는 가격보다 결과 가치를 먼저 노출
- 가격은 카드 하단 작은 보조 정보 또는 `/pricing`에서 노출

---

## 5. 결과 페이지 개편안

### 5.1 첫 화면 재정렬

#### 목표

결과 첫 800px에서 사용자가 “읽을 가치”를 바로 느껴야 한다.

#### 구조

```text
[오늘의 판정]
밀어붙이면 손해, 확인하면 이익.

[점수/키워드]
72점 · 조율

[왜]
금 기운이 강해 말이 날카로워지기 쉽습니다.

[조심]
같은 말을 반복하지 마세요.

[오늘 할 행동]
중요한 연락은 한 번 적고 보내세요.

[근거]
甲 일간 · 금 압박 · 관계 조율 · 세운 영향

[CTA]
심층 리포트 열기
이 결과로 바로 질문하기
PDF로 저장하기
```

### 5.2 Result Asset Hub

UMG의 `결과 다시보기` 구조를 달빛인생식으로 적용한다.

```text
내 결과는 다시 볼 수 있습니다

- MY 보관함에 저장
- PDF 소장 가능
- 같은 결과로 이어서 질문 가능
- 가족/상대 프로필과 비교 가능
```

#### Codex 작업

- `src/components/result/result-asset-hub.tsx` 추가
- 결과 페이지 CTA 영역을 `ResultAssetHub`로 교체
- `MY 보관함`, `PDF`, `대화`를 동일한 가치 계층으로 묶기

---

## 6. MY 페이지 개편안

### 목표

UMG의 `나만을 위한 내 사주 결과 다시보기` 구조처럼, MY를 단순 계정 페이지가 아니라 재방문 허브로 만든다.

### 구조

```text
나만을 위한
내 사주 결과 다시보기

최근 본 결과
- 오늘 1분 리포트
- 올해 전략서
- 관계 패턴 리포트

빠른 메뉴
- 쿠폰함
- 정보 관리
- 무료 만세력
- 친구 추천
- PDF 보관함
```

### Codex 작업

- `/my` 또는 `/u` 라우트 UI를 `ResultArchiveHub` 중심으로 개편
- 로그인 CTA는 카카오 로그인 우선
- 최근 결과가 없으면 샘플 결과/오늘 1분 운세로 유도

---

## 7. 카피 시스템: Punch Copy Engine

### 목적

고리타분한 장문 운세를 줄이고, 첫 문장부터 임팩트 있게 만든다.

### 타입

```ts
export interface PunchReading {
  score?: number;
  keyword: string;
  verdict: string;
  why: string;
  caution: string;
  action: string;
  evidence: string[];
}
```

### 문장 규칙

| 항목 | 길이 | 예시 |
|---|---:|---|
| verdict | 20자 이내 | 오늘은 밀기보다 확인. |
| why | 45자 이내 | 금 기운이 강해 말이 날카로워지기 쉽습니다. |
| caution | 35자 이내 | 같은 말을 반복하지 마세요. |
| action | 35자 이내 | 중요한 연락은 한 번 적고 보내세요. |
| evidence | 2~4개 | 甲 일간 · 금 압박 · 세운 영향 |

### 예시 문장

#### 재물

```text
판정: 돈은 버는 쪽보다 새는 쪽이 문제.
왜: 재성은 보이지만 토대가 약해 지출이 먼저 흔들립니다.
조심: 충동 결제와 체면 지출을 줄이세요.
행동: 이번 주 고정비 3개만 다시 보세요.
```

#### 연애

```text
판정: 연락은 가능. 결론부터 묻지 마세요.
왜: 감정은 남아 있지만 말의 속도가 다릅니다.
조심: 확인받으려는 질문이 반복되면 멀어집니다.
행동: 가벼운 안부 하나만 보내세요.
```

#### 직장

```text
판정: 이직보다 역할 재정의가 먼저.
왜: 이동운보다 책임 조정 운이 먼저 들어옵니다.
조심: 불만을 바로 퇴사 결론으로 넘기지 마세요.
행동: 맡은 일과 버릴 일을 표로 나누세요.
```

#### 가족

```text
판정: 싸움의 원인은 말투보다 역할입니다.
왜: 기대하는 자리와 실제 책임이 어긋납니다.
조심: 옳고 그름으로 몰아가면 길어집니다.
행동: 부탁과 요구를 분리해서 말하세요.
```

#### 올해

```text
판정: 올해는 확장보다 정리.
왜: 새 판보다 기존 자원을 묶는 흐름이 강합니다.
조심: 욕심내서 일을 벌리면 체력이 먼저 빠집니다.
행동: 상반기에는 줄이고, 하반기에 밀어보세요.
```

---

## 8. 디자인 토큰

### 폰트

- 기본: `Noto Sans KR`
- 숫자/가격/점수: system sans 또는 `Noto Sans KR`
- 한자/고전 인용: `Noto Serif KR` 제한 사용
- 장문 본문: `Noto Sans KR`, line-height 1.65~1.75

### 컬러

```css
:root {
  --dalbit-bg: #070A13;
  --dalbit-panel: rgba(17, 21, 38, 0.92);
  --dalbit-panel-soft: rgba(255, 255, 255, 0.045);
  --dalbit-gold: #D4B06A;
  --dalbit-gold-bright: #EBCB84;
  --dalbit-ivory: #F1E8D4;
  --dalbit-muted: rgba(241, 232, 212, 0.68);
  --dalbit-line: rgba(212, 176, 106, 0.18);
  --dalbit-jade: #6BA68B;
  --dalbit-coral: #E08370;
  --dalbit-sky: #7BA3CC;
}
```

### 카드 스타일

```css
.dalbit-premium-card {
  border: 1px solid var(--dalbit-line);
  border-radius: 24px;
  background:
    radial-gradient(circle at 20% 0%, rgba(212,176,106,.16), transparent 34%),
    linear-gradient(180deg, rgba(22,26,46,.96), rgba(8,10,18,.98));
  box-shadow: 0 24px 72px rgba(0,0,0,.32);
}
```

---

## 9. 금지 사항

Codex는 아래 표현을 제거하거나 새로 추가하지 않는다.

- 허위 또는 검증 불가 표현: `대한민국 1위`, `압도적 1위`, `100% 적중`, `반드시`, `무조건`
- 공포 마케팅: `대흉`, `실패 확정`, `헤어져야 함`, `큰일남`
- 저가몰 인상: `990원 사주`, `용하다고 소문난`, `궁합도 잘봐요`
- UMG 직접 복제: `음양관`, `정1품`, `조선 왕`, `백년사주` 등 고유 표현 차용 금지
- 허위 리뷰/허위 구매 수/허위 할인율 생성 금지

---

## 10. Codex 작업 지시서

### Branch

```bash
git checkout -b codex/umg-style-moonlight-conversion
```

### P0 작업

1. 현재 공개 홈에서 사주아이/저가몰 인상을 주는 문구 제거
   - `猫`
   - `사주 990원`
   - `궁합 990원`
   - `대운 990원`
   - `용하다고 소문난`
   - `궁합도 잘봐요`
   - `비법 택일`

2. 홈 Hero를 다음 구조로 교체
   - headline: `오늘의 선택, 한 줄로 정리하세요.`
   - subcopy: `원국·오행·십신·합충을 바탕으로 지금 조심할 패턴과 바로 할 행동을 짧게 보여드립니다.`
   - primary CTA: `지금 고민 고르기`
   - secondary CTA: `오늘 1분 운세 보기`
   - trust line: `저장 가능 · 다시보기 가능 · 근거 펼침 · 공포성 단정 없음`

3. `src/domain/saju/report/punch-copy.ts` 생성
   - `PunchReading` 타입
   - `buildPunchReading(report, sajuData, topic)` 함수
   - 주제별 verdict/why/caution/action 생성

4. 결과 페이지 첫 화면에 `PunchReadingCard` 추가
   - 판정
   - 점수/키워드
   - 왜
   - 조심
   - 오늘 할 행동
   - 근거 칩

5. 홈에 `MiniResultPreview` 추가
   - 실제 결과 스타일을 한 장으로 보여줌
   - 장문 설명 금지

6. `Noto Sans KR` 기본 폰트 적용
   - Body와 UI는 Sans
   - Serif는 브랜드 한자/고전 인용에만 사용

### P1 작업

7. `PremiumReportCard` 컴포넌트 추가
   - 카드명, 한 줄 질문, 포함 항목, CTA
   - 허위 할인율/리뷰 수 없음

8. `ResultAssetHub` 추가
   - MY 보관함
   - PDF 소장
   - 결과 기반 대화
   - 다시보기 가능

9. `/my` 또는 `/u`를 결과 보관 허브로 개편
   - `나만을 위한 내 사주 결과 다시보기`
   - 최근 결과
   - 쿠폰/정보관리/PDF/친구추천/무료 만세력

10. `AuthorityMethodPanel` 추가
   - 원국
   - 오행
   - 십신
   - 합충형파해
   - 공망
   - 용신
   - 대운/세운
   - 고전 근거

### P2 작업

11. 실제 구매/리뷰 데이터가 생기면 `RealReviewFeed` 추가
   - 구매인증 여부가 있는 리뷰만 노출
   - 일주 표기는 선택사항
   - 허위 리뷰 절대 금지

12. A/B 테스트 이벤트 추가
   - `home_hero_primary_click`
   - `question_card_click`
   - `mini_result_preview_click`
   - `result_punch_cta_click`
   - `result_pdf_click`
   - `result_dialogue_click`

---

## 11. 파일별 작업 예상

| 파일 | 작업 |
|---|---|
| `src/app/page.tsx` | Hero, 질문 카드, 미리보기 결과, 프리미엄 리포트 섹션 재구성 |
| `src/content/moonlight.ts` | 질문형 카피, 상품명, 신뢰 문구 교체 |
| `src/app/globals.css` | UMG 감성 참고한 프리미엄 카드/ProofBar 스타일 추가 |
| `src/app/layout.tsx` | Noto Sans KR 기본 폰트 적용 |
| `src/domain/saju/report/punch-copy.ts` | 짧은 판정형 해석 생성기 추가 |
| `src/components/report/punch-reading-card.tsx` | 결과 첫 화면 카드 추가 |
| `src/components/home/mini-result-preview.tsx` | 홈 미리보기 결과 카드 추가 |
| `src/components/result/result-asset-hub.tsx` | 결과 보관/대화/PDF 허브 추가 |
| `src/components/home/premium-report-card.tsx` | 프리미엄 리포트 상품 카드 추가 |
| `src/app/my/page.tsx` 또는 관련 MY 라우트 | 결과 다시보기 허브화 |

---

## 12. QA 체크리스트

- [ ] 홈 첫 화면에서 `990원`, `猫`, `용하다고`, `궁합도 잘봐요` 제거됨
- [ ] 홈 첫 화면의 primary CTA가 `지금 고민 고르기`로 명확함
- [ ] 모바일 390px 기준 첫 화면에서 CTA가 보임
- [ ] 결과 페이지 첫 화면에서 판정/조심/행동이 5초 내 이해됨
- [ ] 장문 해석은 접힘 또는 하단으로 이동함
- [ ] MY 보관함/대화/PDF CTA가 결과 페이지에서 연결됨
- [ ] 허위 리뷰·허위 할인·검증 불가 1위 표현 없음
- [ ] `npm run typecheck` 통과
- [ ] `npm test` 통과
- [ ] `npm run build` 통과

---

## 13. PR 제목 및 설명

### PR Title

```text
[codex] apply premium fortune UX and punch reading system
```

### PR Summary

```md
## Summary
- Repositioned the public home from low-price fortune cards to question-first premium saju reports.
- Added punch-style reading copy structure for verdict, caution, action, and evidence chips.
- Added mini result preview, premium report cards, and result asset hub patterns.
- Removed low-price/copycat phrases and strengthened storage, evidence, and no-fear trust signals.

## Validation
- npm run typecheck
- npm test
- npm run build
```
