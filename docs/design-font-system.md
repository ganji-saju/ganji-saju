# 달빛인생 디자인 폰트 시스템

달빛인생은 전체 화면을 장식적인 명조체로 바꾸지 않고, **본문은 또렷하게**, **버튼과 카드 제목은 바로 읽히게** 폰트를 나눠 씁니다.

## 1. 폰트 역할

### Body / UI
- 우선 순위: `Pretendard`, `Pretendard Variable`
- fallback: `system-ui`, `Apple SD Gothic Neo`, `Noto Sans KR`, `sans-serif`
- 역할:
  - 입력폼
  - 버튼
  - 표
  - 가격 카드
  - 대화 UI
  - 긴 본문

### Display / Brand
- 현재 적용: `Noto Serif KR` via `next/font/google`
- fallback: `Noto Serif KR`, `Nanum Myeongjo`, `serif`
- 역할:
  - 홈 Hero title
  - 샘플 풀이 Hero title
  - 멤버십 Hero title
  - 리포트 표지/결과 화면 대제목
  - “오늘 뭐가 궁금하세요?” 계열 대문구

### Classic / Quote
- 현재 적용: `Gowun Batang` via `next/font/google`
- fallback: `Noto Serif KR`, `Nanum Myeongjo`, `serif`
- 역할:
  - 고전 원문 인용
  - 리포트 인용 카드
  - 고전/근거 패널의 원문 영역

### Hanja
- 현재 적용: `Noto Serif KR`
- fallback: `Noto Serif KR`, `Nanum Myeongjo`, `serif`
- 역할:
  - `甲木`, `乙木`, `丙火`, `用神`, `格局`
  - 간지/천간/지지 표시
  - 명식 카드의 한자/간지 라인

## 2. CSS 변수

- `--font-body`
- `--font-display`
- `--font-classic`
- `--font-hanja`

보조 호환용:
- `--font-sans` → `var(--font-body)`
- `--font-heading` → `var(--font-display)`

## 3. 적용 위치

### font-display
- `/`
- `/sample-report`
- `/membership`
- `/saju/[slug]/overview`
- `/saju/[slug]/premium`
- `PageHero` 공통 타이틀

### font-classic
- `ClassicEvidencePanel`의 원문 blockquote
- 샘플 기준서 인용 카드

### font-hanja
- 명식 카드의 천간/지지
- 일간/간지 표시
- fact/evidence 패널의 간지 줄
- 한자 라벨이 포함된 소제목 일부

## 4. 사용하지 말아야 할 위치

- 전체 body
- 입력폼 전체
- 버튼 전체
- 가격표 숫자 전체
- 대화 말풍선 전체
- 긴 설명 본문 전체

달빛인생은 **명조체를 분위기용으로만 제한적으로 사용**하고, 실제 사용성은 본문 고딕으로 유지합니다.

## 5. 성능 주의사항

- `next/font/google` 사용 시 `display: "swap"` 유지
- 불필요한 weight를 모두 로드하지 않기
- 같은 역할에 폰트를 추가로 여러 개 겹치지 않기
- Hanja와 고전 인용은 같은 serif 계열을 재사용해 payload를 늘리지 않기

## 6. 라이선스 확인 메모

- `MaruBuri`는 이번 단계에서 적용하지 않았습니다.
  - 현재 레포에는 검증된 폰트 파일/로딩 경로가 없고
  - 상업적 사용 확인 메모를 함께 남기지 않은 상태에서 임의 추가하지 않기 위해 보류했습니다.
- `Noto Serif KR`는 `next/font/google` 경유로만 사용합니다.
  - 레포에 폰트 바이너리를 직접 체크인하지 않습니다.
- `Gowun Batang`도 `next/font/google` 경유로만 사용합니다.
  - 고전 인용/quote 역할에만 제한적으로 사용합니다.
- `Pretendard`는 현재 시스템/환경 우선 스택으로만 사용합니다.
  - 별도 폰트 파일을 레포에 추가하지 않았습니다.

## 7. Tailwind 구현 메모

이 프로젝트는 별도 `tailwind.config.ts` 없이 **Tailwind v4 `@theme inline` 토큰 방식**을 사용합니다.

즉 폰트 역할 확장은 config 파일이 아니라 아래 위치에서 관리합니다.

- `/Users/kionya/ganji-saju/src/app/globals.css`

매핑 원칙:
- `--font-sans` → `var(--font-body)`
- `--font-heading` → `var(--font-display)`
- `.font-display` → `var(--font-display)`
- `.font-classic` → `var(--font-classic)`
- `.font-hanja` → `var(--font-hanja)`
