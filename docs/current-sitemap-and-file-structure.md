# Ganji Saju Current Sitemap And File Structure

작성일: 2026-05-08  
기준 커밋: `fa55068`  
프로젝트 경로: `/Users/kionya/ganji-saju`  
운영 도메인 기준: `https://www.xn--s39at50bo6fmwa.kr`

이 문서는 현재 Next.js App Router 기준의 실제 사이트맵과 주요 파일 구조를 한눈에 확인하기 위한 보관용 문서입니다.

## 1. 사이트맵

### 1.1 메인/무료 진입

- `/`  
  - 파일: `src/app/page.tsx`
  - 역할: 메인 홈, 무료 운세/타로/사주 상품 진입
- `/free`  
  - 파일: `src/app/free/page.tsx`
  - 역할: 무료 운세 진입 모음
- `/today`  
  - 파일: `src/app/today/page.tsx`
  - 역할: 오늘 운세 별도 진입
- `/today-fortune`  
  - 파일: `src/app/today-fortune/page.tsx`
  - 역할: 오늘 운세 입력/선택 흐름
- `/today-fortune/result`  
  - 파일: `src/app/today-fortune/result/page.tsx`
  - 역할: 오늘 운세 무료 결과
- `/today-fortune/detail`  
  - 파일: `src/app/today-fortune/detail/page.tsx`
  - 역할: 오늘 운세 상세 풀이

### 1.2 사주 입력/결과

- `/saju`  
  - 파일: `src/app/saju/page.tsx`
  - 역할: 사주 서비스 진입
- `/saju/new`  
  - 파일: `src/app/saju/new/page.tsx`
  - 역할: 사주 입력 메인
- `/saju/new/birth`  
  - 파일: `src/app/saju/new/birth/page.tsx`
  - 역할: 생년월일/출생 정보 입력 단계
- `/saju/new/empathy`  
  - 파일: `src/app/saju/new/empathy/page.tsx`
  - 역할: 관심사/상황 선택 단계
- `/saju/new/nickname`  
  - 파일: `src/app/saju/new/nickname/page.tsx`
  - 역할: 이름/호칭 입력 단계
- `/saju/new/consent`  
  - 파일: `src/app/saju/new/consent/page.tsx`
  - 역할: 동의 단계
- `/saju/[slug]`  
  - 파일: `src/app/saju/[slug]/page.tsx`
  - 역할: 사주 무료 결과, 소액 결제 진입
- `/saju/[slug]/today-detail`  
  - 파일: `src/app/saju/[slug]/today-detail/page.tsx`
  - 역할: 550원 오늘 상세 풀이
- `/saju/[slug]/premium`  
  - 파일: `src/app/saju/[slug]/premium/page.tsx`
  - 역할: 깊은 사주풀이/프리미엄 결과
- `/saju/[slug]/premium/print`  
  - 파일: `src/app/saju/[slug]/premium/print/page.tsx`
  - 역할: 프린트/PDF용 프리미엄 결과
- `/saju/[slug]/overview`  
  - 파일: `src/app/saju/[slug]/overview/page.tsx`
  - 역할: 결과 개요
- `/saju/[slug]/elements`  
  - 파일: `src/app/saju/[slug]/elements/page.tsx`
  - 역할: 오행 중심 결과
- `/saju/[slug]/nature`  
  - 파일: `src/app/saju/[slug]/nature/page.tsx`
  - 역할: 성정/기질 중심 결과

### 1.3 타로

- `/tarot`  
  - 파일: `src/app/tarot/page.tsx`
  - 역할: 타로 서비스 진입
- `/tarot/daily`  
  - 파일: `src/app/tarot/daily/page.tsx`
  - 역할: 오늘의 타로 시작
- `/tarot/daily/pick`  
  - 파일: `src/app/tarot/daily/pick/page.tsx`
  - 역할: 카드 선택 화면
- `/tarot/daily/result`  
  - 파일: `src/app/tarot/daily/result/page.tsx`
  - 역할: 타로 결과 화면

### 1.4 궁합

- `/compatibility`  
  - 파일: `src/app/compatibility/page.tsx`
  - 역할: 궁합 서비스 진입
- `/compatibility/input`  
  - 파일: `src/app/compatibility/input/page.tsx`
  - 역할: 내 정보/상대 정보 입력
- `/compatibility/result`  
  - 파일: `src/app/compatibility/result/page.tsx`
  - 역할: 궁합 결과
- `/gunghap`  
  - 파일: `src/app/gunghap/page.tsx`
  - 역할: 궁합 별도 랜딩/레거시 진입

### 1.5 띠/별자리/택일/대운

- `/zodiac`  
  - 파일: `src/app/zodiac/page.tsx`
  - 역할: 띠운세 목록
- `/zodiac/[slug]`  
  - 파일: `src/app/zodiac/[slug]/page.tsx`
  - 역할: 특정 띠운세 결과
- `/star-sign`  
  - 파일: `src/app/star-sign/page.tsx`
  - 역할: 별자리 운세 목록
- `/star-sign/[slug]`  
  - 파일: `src/app/star-sign/[slug]/page.tsx`
  - 역할: 특정 별자리 운세 결과
- `/taekil`  
  - 파일: `src/app/taekil/page.tsx`
  - 역할: 택일 서비스
- `/daewoon`  
  - 파일: `src/app/daewoon/page.tsx`
  - 역할: 대운 서비스

### 1.6 대화방

- `/dialogue`  
  - 파일: `src/app/dialogue/page.tsx`
  - 역할: 12지신/전문 상담 진입
- `/dialogue/[expert]`  
  - 파일: `src/app/dialogue/[expert]/page.tsx`
  - 역할: 선택한 12지신 상담방
- `/dialogue/safe-redirect`  
  - 파일: `src/app/dialogue/safe-redirect/page.tsx`
  - 역할: 안전 안내/전문 도움 연결

### 1.7 결제/가격/코인

- `/pricing`  
  - 파일: `src/app/pricing/page.tsx`
  - 역할: 가격/상품 안내
- `/membership`  
  - 파일: `src/app/membership/page.tsx`
  - 역할: 멤버십/상품 목록
- `/membership/checkout`  
  - 파일: `src/app/membership/checkout/page.tsx`
  - 역할: 상품 결제 단계
- `/membership/complete`  
  - 파일: `src/app/membership/complete/page.tsx`
  - 역할: 결제 완료 처리
- `/membership/success`  
  - 파일: `src/app/membership/success/page.tsx`
  - 역할: 결제 성공 후 이동
- `/pay`  
  - 파일: `src/app/pay/page.tsx`
  - 역할: 결제 진입/결제 보조 페이지
- `/credits`  
  - 파일: `src/app/credits/page.tsx`
  - 역할: 코인/크레딧 안내
- `/credits/success`  
  - 파일: `src/app/credits/success/page.tsx`
  - 역할: 코인 결제 성공

### 1.8 MY/보관함/계정

- `/my`  
  - 파일: `src/app/my/page.tsx`
  - 역할: 마이 홈
- `/my/profile`  
  - 파일: `src/app/my/profile/page.tsx`
  - 역할: 프로필/출생 정보 관리
- `/my/results`  
  - 파일: `src/app/my/results/page.tsx`
  - 역할: 저장한 풀이/보관함
- `/my/billing`  
  - 파일: `src/app/my/billing/page.tsx`
  - 역할: 결제/구독 내역
- `/my/settings`  
  - 파일: `src/app/my/settings/page.tsx`
  - 역할: 계정 설정
- `/vault`  
  - 파일: `src/app/vault/page.tsx`
  - 역할: 보관함 별도 진입

### 1.9 인증/알림

- `/login`  
  - 파일: `src/app/login/page.tsx`
  - 역할: 로그인/회원가입 진입
- `/auth`  
  - 파일: `src/app/auth/page.tsx`
  - 역할: 인증 보조 페이지
- `/reset-password`  
  - 파일: `src/app/reset-password/page.tsx`
  - 역할: 비밀번호 재설정
- `/notifications`  
  - 파일: `src/app/notifications/page.tsx`
  - 역할: 알림센터
- `/notifications/schedule`  
  - 파일: `src/app/notifications/schedule/page.tsx`
  - 역할: 알림 일정 관리
- `/notifications/widget`  
  - 파일: `src/app/notifications/widget/page.tsx`
  - 역할: 알림 위젯

### 1.10 안내/문서성 페이지

- `/guide`  
  - 파일: `src/app/guide/page.tsx`
  - 역할: 서비스 안내
- `/about-engine`  
  - 파일: `src/app/about-engine/page.tsx`
  - 역할: 계산/풀이 방식 안내
- `/method`  
  - 파일: `src/app/method/page.tsx`
  - 역할: 방법론/풀이 기준 안내
- `/method/[slug]`  
  - 파일: `src/app/method/[slug]/page.tsx`
  - 역할: 방법론 상세
- `/myeongri`  
  - 파일: `src/app/myeongri/page.tsx`
  - 역할: 명리 안내
- `/myeongri/ten-gods`  
  - 파일: `src/app/myeongri/ten-gods/page.tsx`
  - 역할: 십성 안내
- `/interpretation`  
  - 파일: `src/app/interpretation/page.tsx`
  - 역할: 해석 안내
- `/sample-report`  
  - 파일: `src/app/sample-report/page.tsx`
  - 역할: 샘플 리포트
- `/dream-interpretation`  
  - 파일: `src/app/dream-interpretation/page.tsx`
  - 역할: 꿈해몽 목록
- `/dream-interpretation/[slug]`  
  - 파일: `src/app/dream-interpretation/[slug]/page.tsx`
  - 역할: 꿈해몽 상세
- `/verification`  
  - 파일: `src/app/verification/page.tsx`
  - 역할: 검증/진단 페이지

### 1.11 법적/검색 엔진

- `/privacy`  
  - 파일: `src/app/privacy/page.tsx`
  - 역할: 개인정보처리방침
- `/terms`  
  - 파일: `src/app/terms/page.tsx`
  - 역할: 이용약관
- `/robots.txt`  
  - 파일: `src/app/robots.ts`
  - 역할: 검색 엔진 로봇 정책
- `/sitemap.xml`  
  - 파일: `src/app/sitemap.ts`
  - 역할: 검색 엔진 사이트맵
- `/manifest.webmanifest`  
  - 파일: `src/app/manifest.ts`
  - 역할: PWA 매니페스트

## 2. API 사이트맵

### 2.1 AI/풀이

- `/api/ai`  
  - 파일: `src/app/api/ai/route.ts`
  - 역할: 대화형 AI 응답
- `/api/interpret`  
  - 파일: `src/app/api/interpret/route.ts`
  - 역할: 사주 풀이 생성
- `/api/interpret/lifetime`  
  - 파일: `src/app/api/interpret/lifetime/route.ts`
  - 역할: 장기/평생형 풀이 생성
- `/api/interpret/yearly`  
  - 파일: `src/app/api/interpret/yearly/route.ts`
  - 역할: 연간 풀이 생성
- `/api/classics/evidence`  
  - 파일: `src/app/api/classics/evidence/route.ts`
  - 역할: 고전 근거/참고 데이터 조회

### 2.2 인증/프로필

- `/api/auth/callback`  
  - 파일: `src/app/api/auth/callback/route.ts`
  - 역할: Supabase Auth 콜백
- `/api/auth/confirm-email`  
  - 파일: `src/app/api/auth/confirm-email/route.ts`
  - 역할: 이메일 인증 처리
- `/api/auth/signup`  
  - 파일: `src/app/api/auth/signup/route.ts`
  - 역할: 회원가입 처리
- `/api/profile`  
  - 파일: `src/app/api/profile/route.ts`
  - 역할: 내 프로필 저장/조회
- `/api/profile/counselor`  
  - 파일: `src/app/api/profile/counselor/route.ts`
  - 역할: 선호 상담 스타일 저장/조회
- `/api/family-profiles`  
  - 파일: `src/app/api/family-profiles/route.ts`
  - 역할: 가족 프로필 저장/조회
- `/api/readings`  
  - 파일: `src/app/api/readings/route.ts`
  - 역할: 저장한 풀이 조회/관리

### 2.3 결제/권한/코인

- `/api/payments/confirm`  
  - 파일: `src/app/api/payments/confirm/route.ts`
  - 역할: Toss 결제 승인/권한 부여
- `/api/credits/use`  
  - 파일: `src/app/api/credits/use/route.ts`
  - 역할: 코인 사용 처리
- `/api/subscription/manage`  
  - 파일: `src/app/api/subscription/manage/route.ts`
  - 역할: 구독 관리
- `/api/fortune-calendar/unlock`  
  - 파일: `src/app/api/fortune-calendar/unlock/route.ts`
  - 역할: 월간 달력 해금
- `/api/today-fortune/unlock`  
  - 파일: `src/app/api/today-fortune/unlock/route.ts`
  - 역할: 오늘 운세 상세 해금

### 2.4 오늘운세/달력/위치

- `/api/today-fortune`  
  - 파일: `src/app/api/today-fortune/route.ts`
  - 역할: 오늘 운세 생성/조회
- `/api/today-fortune/feedback`  
  - 파일: `src/app/api/today-fortune/feedback/route.ts`
  - 역할: 오늘 운세 피드백
- `/api/fortune-calendar`  
  - 파일: `src/app/api/fortune-calendar/route.ts`
  - 역할: 월간 운세 달력
- `/api/geo/birth-location`  
  - 파일: `src/app/api/geo/birth-location/route.ts`
  - 역할: 출생지 검색/좌표 조회

### 2.5 알림

- `/api/notifications/preferences`  
  - 파일: `src/app/api/notifications/preferences/route.ts`
  - 역할: 알림 설정 저장/조회
- `/api/notifications/subscribe`  
  - 파일: `src/app/api/notifications/subscribe/route.ts`
  - 역할: Web Push 구독 등록
- `/api/notifications/unsubscribe`  
  - 파일: `src/app/api/notifications/unsubscribe/route.ts`
  - 역할: Web Push 구독 해제
- `/api/notifications/dispatch`  
  - 파일: `src/app/api/notifications/dispatch/route.ts`
  - 역할: 알림 발송
- `/api/notifications/heartbeat`  
  - 파일: `src/app/api/notifications/heartbeat/route.ts`
  - 역할: 알림 상태 확인
- `/api/notifications/test`  
  - 파일: `src/app/api/notifications/test/route.ts`
  - 역할: 테스트 알림

### 2.6 검증/QA

- `/api/verification/saju`  
  - 파일: `src/app/api/verification/saju/route.ts`
  - 역할: 사주 계산 검증
- `/api/verification/today-fortune`  
  - 파일: `src/app/api/verification/today-fortune/route.ts`
  - 역할: 오늘 운세 검증
- `/api/verification/yearly`  
  - 파일: `src/app/api/verification/yearly/route.ts`
  - 역할: 연간 풀이 검증
- `/api/verification/lifetime`  
  - 파일: `src/app/api/verification/lifetime/route.ts`
  - 역할: 장기 풀이 검증
- `/api/verification/classics`  
  - 파일: `src/app/api/verification/classics/route.ts`
  - 역할: 고전 근거 검증
- `/api/verification/profile-linkage`  
  - 파일: `src/app/api/verification/profile-linkage/route.ts`
  - 역할: 프로필 연결 검증
- `/api/dialogue/safety`  
  - 파일: `src/app/api/dialogue/safety/route.ts`
  - 역할: 상담 안전 필터

## 3. 현재 파일 구조

### 3.1 루트

- `.env.development.local`
- `.env.example`
- `.env.local`
- `.gitignore`
- `AGENTS.md`
- `CLAUDE.md`
- `README.md`
- `components.json`
- `next.config.ts`
- `package.json`
- `package-lock.json`
- `postcss.config.mjs`
- `skills-lock.json`
- `tsconfig.json`
- `vercel.json`

### 3.2 주요 디렉터리

- `.agents/`
  - 로컬 에이전트/스킬 관련 자료
- `.lazyweb/`
  - Lazyweb 디자인 리서치/개선 산출물
- `.vercel/`
  - Vercel 프로젝트 연결 정보
- `docs/`
  - 설계 문서, 운영 체크리스트, 백업 문서, QA 문서
- `external/`
  - 외부 사주 코퍼스/참고 패키지
- `layout/`
  - 시안/디자인 handoff 자료
- `public/`
  - 정적 이미지, 영상, PWA 리소스
- `scripts/`
  - 테스트/운영 보조 스크립트
- `src/`
  - 실제 Next.js 애플리케이션 소스
- `supabase/`
  - Supabase migration, template, local 설정

### 3.3 `src/app`

- `src/app/layout.tsx`
  - 루트 레이아웃
- `src/app/globals.css`
  - 전역 CSS import 진입점
- `src/app/styles/`
  - `tokens.css`: 색상/폰트/디자인 토큰
  - `base.css`: 기본 HTML/body 스타일
  - `components.css`: 공통 컴포넌트 스타일
  - `app-shell.css`: 앱형 레이아웃/헤더/하단바
  - `home.css`: 홈 전용 스타일
  - `subpages.css`: 서브페이지 공통 스타일
  - `mobile-polish.css`: 모바일 보정 스타일
  - `dialogue-reports.css`: 대화/리포트 관련 스타일
  - `flow-polish.css`: 결과/결제 흐름 보정 스타일
  - `responsive-print.css`: 프린트/PDF 반응형 스타일
- `src/app/api/`
  - 서버 API route 모음
- `src/app/saju/`
  - 사주 입력/결과/상세/프리미엄 페이지
- `src/app/tarot/`
  - 타로 시작/카드 선택/결과 페이지
- `src/app/today-fortune/`
  - 오늘 운세 경험/결과/상세 페이지
- `src/app/compatibility/`
  - 궁합 입력/결과 페이지
- `src/app/my/`
  - 마이/프로필/보관함/결제 내역
- `src/app/membership/`
  - 멤버십/체크아웃/결제 완료
- `src/app/dialogue/`
  - 대화방/12지신 상담
- `src/app/zodiac/`
  - 띠운세
- `src/app/star-sign/`
  - 별자리 운세
- `src/app/notifications/`
  - 알림센터/알림 설정

### 3.4 `src/components`

- `src/components/gangi/`
  - 현재 Ganji 디자인 시스템 기반 UI 컴포넌트
- `src/components/ui/`
  - 기본 UI 원자 컴포넌트
- `src/components/layout/`
  - 섹션, 그리드, CTA, 보조 레일 등 레이아웃 컴포넌트
- `src/components/saju/`
  - 사주 결과/오행/근거/모바일 결과 컴포넌트
- `src/components/tarot/`
  - 타로 카드 아트워크
- `src/components/today-fortune/`
  - 오늘 운세 카드/점수/상세 패널
- `src/components/dialogue/`
  - 대화창 패널
- `src/components/report/`
  - 리포트/판정 근거/출력 관련 컴포넌트
- `src/components/my/`
  - 프로필/보관함/구독 관리 컴포넌트
- `src/components/payments/`
  - 결제수단 UI
- `src/components/membership/`
  - Toss 멤버십 체크아웃 UI
- `src/components/site-header.tsx`
  - 사이트 헤더
- `src/components/site-footer.tsx`
  - 사이트 푸터

### 3.5 `src/features`

- `src/features/home/`
  - 홈 화면 섹션, 배너, 모바일 도크
- `src/features/saju-intake/`
  - 사주 입력 플로우
- `src/features/saju-detail/`
  - 사주 결과 추적/화면 네비게이션
- `src/features/today-fortune/`
  - 오늘 운세 경험/상세/결과 클라이언트
- `src/features/compatibility/`
  - 궁합 입력/결과 클라이언트
- `src/features/notifications/`
  - 알림센터 페이지 로직
- `src/features/account/`
  - 계정 영역 네비게이션
- `src/features/shared-navigation/`
  - 공통 네비게이션/카테고리 히어로

### 3.6 `src/domain`

- `src/domain/saju/engine/`
  - 사주 계산 엔진, 오러리 어댑터
- `src/domain/saju/report/`
  - 사주 리포트 빌더, 연간/평생/월간 달력, grounding, topic rule
- `src/domain/saju/validation/`
  - KASI 달력 비교/검증
- `src/domain/saju/validators/`
  - 출생 입력 검증
- `src/domain/safety/`
  - 안전 리다이렉트/위기 질문 차단

### 3.7 `src/lib`

- `src/lib/saju/`
  - 사주 데이터 타입, 공개 카피, 결과 링크, 권한/상세 접근
- `src/lib/payments/`
  - 결제 상품 카탈로그, Toss 결제, 결제 승인 검증
- `src/lib/credits/`
  - 코인 차감, AI 채팅 접근, 달력/상세 리포트 접근
- `src/lib/supabase/`
  - Supabase client/server helper
- `src/lib/today-fortune/`
  - 오늘 운세 concern/type helper
- `src/lib/profile.ts`
  - 프로필 파싱/저장 helper
- `src/lib/report-entitlements.ts`
  - 리포트 권한 helper
- `src/lib/product-entitlements.ts`
  - 상품 구매 권한 helper
- `src/lib/dialogue-experts.ts`
  - 12지신/대화 전문가 정의
- `src/lib/site-navigation.ts`
  - 사이트 네비게이션 정의

### 3.8 `src/server`

- `src/server/ai/`
  - OpenAI 호출, 사주/연간/평생 풀이 프롬프트와 파서
- `src/server/today-fortune/`
  - 오늘 운세 생성 로직
- `src/server/home/`
  - 홈 배너 서버 데이터
- `src/server/classics/`
  - 고전 근거 조회
- `src/server/verification/`
  - 운영 검증/감사용 로직

### 3.9 `src/content` / `src/data` / `src/shared`

- `src/content/`
  - 홈/상품/멘토/콘텐츠 카탈로그
- `src/data/`
  - 타로 카드 JSON 등 정적 데이터
- `src/shared/config/`
  - 공유 설정
- `src/shared/layout/`
  - AppShell 등 공통 레이아웃

### 3.10 `supabase`

- `supabase/migrations/`
  - DB schema 변경 이력
- `supabase/templates/`
  - 이메일/인증 템플릿
- `supabase/.temp/`
  - Supabase CLI 임시 파일

## 4. 현재 핵심 사용자 흐름

### 4.1 무료 사주풀이 흐름

- `/`
- `/saju/new`
- `/saju/[slug]`
- `/membership/checkout?product=today-detail&slug=...`
- `/saju/[slug]/today-detail`
- `/my/results`

### 4.2 오늘운세 흐름

- `/`
- `/today-fortune`
- `/today-fortune/result`
- `/today-fortune/detail`
- `/my/results`

### 4.3 타로 흐름

- `/`
- `/tarot`
- `/tarot/daily`
- `/tarot/daily/pick`
- `/tarot/daily/result`

### 4.4 궁합 흐름

- `/`
- `/compatibility`
- `/compatibility/input`
- `/compatibility/result`

### 4.5 결제/권한 흐름

- `/pricing` 또는 `/membership`
- `/membership/checkout`
- `/api/payments/confirm`
- `/membership/success`
- 구매 상품별 결과 페이지 또는 `/my/results`

## 5. 다음 구조 점검 시 우선 확인할 파일

- `src/app/saju/[slug]/page.tsx`
  - 무료 결과와 소액 결제 진입
- `src/app/saju/[slug]/today-detail/page.tsx`
  - 550원 오늘 상세 풀이
- `src/app/membership/checkout/page.tsx`
  - 결제 화면
- `src/lib/payments/catalog.ts`
  - 상품명/가격/상품 ID
- `src/lib/product-entitlements.ts`
  - 구매 권한 확인
- `src/lib/report-entitlements.ts`
  - 리포트 재열람 권한
- `src/app/api/payments/confirm/route.ts`
  - 결제 완료 후 권한 저장
- `src/app/my/results/page.tsx`
  - 보관함/재열람
- `src/features/saju-intake/saju-intake-page.tsx`
  - 사주 입력 폼
- `src/components/gangi/gangi-ui.tsx`
  - Ganji 공통 UI 기준
- `src/app/styles/flow-polish.css`
  - 결과/결제 흐름 UI 보정
