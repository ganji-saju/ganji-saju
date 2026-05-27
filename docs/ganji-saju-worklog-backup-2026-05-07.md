# 간지사주 작업 기록 및 백업 메모

작성일: 2026-05-07  
대상 저장소: `/Users/kionya/ganji-saju`  
GitHub 원격: `git@github.com-ganji-saju:ganji-saju/ganji-saju.git`  
운영 도메인: `https://xn--s39at50bo6fmwa.kr`  
보조 도메인: `https://www.ganjisaju.kr`

## 1. 현재 기준

- 기본 브랜치: `main`
- upstream 원본 `kionya/saju-app`은 읽기용으로만 남기고 push는 막아둠
- ganji-saju 전용 GitHub SSH 원격을 사용
- Vercel production은 ganji-saju 프로젝트로 배포
- Supabase, Vercel, GitHub는 기존 운영 계정 흐름과 분리하는 방향

## 2. 지금까지 확정된 서비스 방향

간지사주는 프리미엄 명리 리포트 앱이 아니라, 쉽고 빠르게 눌러보는 모바일 운세 상품 서비스로 정리한다.

핵심 원칙:

- 사이트명은 `간지사주`를 전면 사용
- 흰 배경, 블랙 텍스트, 핑크 포인트를 기본 디자인으로 사용
- 첫 화면은 설명보다 바로 누르는 운세/타로/사주/궁합 진입을 우선
- 전문용어, 엔진, 판정근거, 표준 서식 설명은 본문 전면에서 걷어내고 필요한 경우 안내/접힘 영역으로 분리
- 550원/990원 소액 풀이 상품은 문제 중심 이름으로 보여줌
- 12간지 캐릭터와 선생 시스템은 메뉴와 상담 흐름의 브랜드 자산으로 유지
- 모바일 웹앱처럼 하단 도크, 큰 버튼, 단순한 카드 구조를 기준으로 삼음

## 3. 주요 구현 내역

### 브랜드/디자인

- `docs/DESIGN.md`를 기준 문서로 사용
- 기존 리포트형 리포트/골드/다크 톤을 걷어내고 간지사주 카드몰형 UI로 전환
- 폰트 굵기와 본문 밀도를 줄이고, 본문은 쉬운 생활 언어 중심으로 정리
- `globals.css`를 기능별 CSS 파일로 분리
- `GangiSection`, `GangiActionRow`, `GangiListLink`, `GangiMiniCard` 등 Gangi 공통 컴포넌트를 생산 기준으로 사용
- 모든 페이지 상단 헤더가 유지되도록 `AppShell` 기본 헤더 구조를 보강

### 홈

- 메인 배너를 롤링/스와이프 가능한 구조로 정리
- 배너 하단 점 인디케이터와 활성 상태를 개선
- 오늘운세, 타로 한 장, 사주, 궁합 등 즉시 진입 카드 중심으로 재배치
- 매일 바뀌는 오늘 한 줄, 랜덤 12간지/별자리 배너 구조 반영

### 사주 입력/결과

- 사주 입력 폼은 모바일 중심으로 양력/음력, 생년월일, 시간, 성별, 출생지를 보기 쉽게 정리
- 저장된 프로필을 불러와 사주 입력에 활용하는 흐름 보강
- 기본 사주 결과는 한 줄 요약, 오행 균형, 재물/연애/직업/건강 짧은 카드 중심으로 단순화
- 무료 결과에서 더 깊은 풀이는 같은 화면 하단이 아니라 별도 상세 페이지로 보내는 방향으로 정리
- 출생지 미입력 표시 문제, 오늘 상세 보기, 550원 상세 풀이 분리 흐름을 점검/수정
- 어려운 한자 풀이, evidence_json, 엔진 내부 메모성 문구는 본문에서 제거하는 방향으로 계속 정리

### 오늘운세/띠운세/별자리

- 오늘운세는 짧은 핵심, 조심할 점, 오늘 할 행동 중심으로 정리
- 좋은 시간, 기회/주의 문구의 반복과 어려운 표현을 줄이는 방향으로 수정
- 띠운세는 사주 연주 기준 계산으로 정리
- 별자리도 띠운세처럼 별자리 목록에서 선택 후 결과를 보는 구조로 정리

### 타로

- 78장 전체 타로 덱 구조와 카드별 풀이 연결
- 타로 카드 선택 화면에 부채꼴 카드 펼침 효과와 hover/선택 효과 반영
- 카드별 결과가 동일하게 나오지 않도록 선택 카드 기반 메시지로 정리
- 결과 화면 텍스트 크기와 볼드 사용을 줄이고 간결한 카드 풀이형으로 조정

### 대화방

- 대화 담당 선생은 12간지 캐릭터 기반으로 정리
- 각 12지신별 담당 분야와 말투/답변 방향을 `DialogueExpert` 데이터로 구성
- 기본 사주 grounding 위에 `expertRagOverlay`를 얹어 분야별 답변 차이를 만들도록 설계
- OpenAI 실패를 가리지 않고 사용자에게 실패 상태를 명확하게 보여주도록 수정
- 대화 말풍선 간격, 좌우 여백, 볼드 과다 문제를 개선

### 결제/권한

- 550원/990원 소액 풀이 상품 진입 UI 정리
- Toss 결제 중심으로 단순화하는 방향
- 이미 구매/해금한 항목은 중복 결제 또는 중복 차감하지 않는 구조를 목표로 정리
- 상세 풀이, 오늘 자세히 보기, 월간/연간 흐름 등은 별도 결과 페이지로 분리하는 방향

### 알림/보관함/계정

- 알림센터는 오늘운세, 오늘타로, 오늘띠 중심으로 축소
- MY, 저장 결과, 삭제 후 숫자 반영, 코인/플랜 표시, 프로필 저장값 연동을 점검
- 로그인/회원가입은 이메일+비밀번호와 사주 기본정보 저장 흐름으로 정리
- Google/Kakao OAuth, Supabase callback, reset-password 화면을 연결

### 운영/배포

- GitHub 원격은 `ganji-saju/ganji-saju`
- Vercel production 도메인은 `xn--s39at50bo6fmwa.kr`
- `www.ganjisaju.kr`은 production으로 alias 연결
- 최근 검증 기준:
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
  - Vercel production deploy

## 4. 최근 커밋 흐름

최근 주요 커밋:

- `8acc956` Keep site header consistent across pages
- `e0259bb` Split global styles by app surface
- `1d19c26` Refine premium yearly report flow
- `20de75a` Move today detail unlock to separate page
- `cd687ec` Improve low-power mobile performance
- `e241bf5` Improve home banner carousel controls
- `0cddf3b` Surface OpenAI quota failures clearly
- `3e72388` Stop masking dialogue OpenAI failures
- `cc6c978` Simplify dialogue answer grounding
- `08f72b7` Make zodiac dialogue answers visibly distinct
- `0d1ae7f` Add zodiac expert RAG overlays
- `823362b` Unify submenu tab styling

## 5. 로컬 미정리 항목

아래 항목은 현재 로컬에 남아 있으나, 이번 기록 기준으로는 별도 판단 대상이다.

- `package.json`
- `package-lock.json`
- `.agents/`
- `docs/dalbitlife_umg_style_adaptation_codex.md`
- `layout/`
- `skills-lock.json`

이 항목들은 바로 삭제하거나 커밋하지 말고, 다음 작업에서 “레포 반영 대상 / 제외 대상”으로 다시 분류한다.

## 6. 외부 백업 위치

복구용 백업은 작업공간의 handoff 폴더에 별도로 둔다.

기본 위치:

`/Users/kionya/Documents/codex/shared/handoffs/from_codex/ganji-saju-backup-2026-05-07/`

생성 대상:

- Git 히스토리 번들
- 현재 작업 폴더 소스 스냅샷
- uncommitted tracked diff
- working tree 상태 기록
- 백업 manifest

보안상 제외:

- `.env`
- `.env.local`
- `.env.development.local`
- `.env.production.local`
- `.git`
- `.next`
- `node_modules`
- `.vercel`

## 7. 복구 방법

Git 번들에서 복구:

```bash
git clone /Users/kionya/Documents/codex/shared/handoffs/from_codex/ganji-saju-backup-2026-05-07/ganji-saju-main.bundle ganji-saju-restored
cd ganji-saju-restored
npm install
npm run build
```

소스 스냅샷에서 복구:

```bash
mkdir ganji-saju-restored
tar -xzf /Users/kionya/Documents/codex/shared/handoffs/from_codex/ganji-saju-backup-2026-05-07/ganji-saju-working-tree.tar.gz -C ganji-saju-restored
cd ganji-saju-restored
npm install
npm run build
```

운영 환경 복구 시 별도로 다시 설정해야 하는 항목:

- Vercel project link
- Vercel environment variables
- Supabase project URL/key/service role
- Toss payment keys
- OpenAI API key
- Web Push public/private key
- OAuth redirect URLs

## 8. 다음 작업 우선순위

1. 상세 풀이/결제 후 이동 흐름을 전 페이지에서 재점검
2. 사주 결과 화면의 카드 중첩, 탭 스타일, 한 줄 요약 글자 크기 정리
3. 좋은 시간 풀이의 반복 문구와 어려운 표현 제거
4. 대화방 12간지 답변 차별화 실제 응답 재검증
5. 결제/로그인/프로필 연결 전수 QA
6. CSS 분리 이후 사용하지 않는 old class 후보 제거
7. 갤럭시 S10 등 저사양 모바일 성능 추가 점검
