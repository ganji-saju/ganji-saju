# QA Acceptance Checklist — 간지사주 리디자인

## Source completeness
- [ ] README.md를 읽었다.
- [ ] `간지사주 리디자인.html`을 전체 읽었다.
- [ ] 모든 import 파일을 읽었다.
- [ ] BOARD_MANIFEST.md가 생성되었다.
- [ ] 13개 모션 보드가 MOTION_SPEC.md에 있다.

## Visual system
- [ ] Noto Sans KR 적용
- [ ] Noto Serif KR / 한자 인장 폰트 적용
- [ ] pink/ink/line/zodiac accent token 적용
- [ ] ZodiacChip 12종 구현
- [ ] Header/Logo/Dock/Footer 적용
- [ ] Card/Button/Badge/Input/Banner 공통화

## Page coverage
- [ ] 01 홈
- [ ] 02-1 사주입력 STEP 1
- [ ] 02-2 사주입력 STEP 2
- [ ] 02-3 사주입력 STEP 3
- [ ] 03 사주 결과
- [ ] 04 오늘운세
- [ ] 04-2 오늘 자세히
- [ ] 05 타로
- [ ] 05-2 타로 풀스프레드
- [ ] 05-3 택일
- [ ] 06 궁합 결과
- [ ] 06-0 궁합 입력
- [ ] 07 대화방
- [ ] 07-0 대화방 목록
- [ ] 08 MY
- [ ] 08-2 프로필 편집
- [ ] 08-3 설정
- [ ] 08-4 고객센터
- [ ] 09 멤버십
- [ ] 10 로그인
- [ ] 11 회원가입
- [ ] 11-2 비밀번호 찾기
- [ ] 11-3 회원탈퇴
- [ ] 15 깊은 사주 풀이
- [ ] 16 결제 페이지
- [ ] 16-0 공유용 결과 카드
- [ ] 16-1 결제 결과
- [ ] 16-2 코인 충전 패키지
- [ ] 16-3 1:1 상담 예약
- [ ] 17 PDF 1페이지
- [ ] 17-2 PDF 2페이지
- [ ] 18 알림 센터
- [ ] 18-0 락스크린 푸시 위젯
- [ ] 19 보관함 상세
- [ ] 20 띠운세 상세
- [ ] 20-2 별자리
- [ ] 21 검색
- [ ] 21-2 꿈해몽 검색
- [ ] 22 영문
- [ ] 23 태블릿
- [ ] 24 배너 시스템
- [ ] 25 에러
- [ ] 26 온보딩
- [ ] 27 푸시 알림 권한 모달
- [ ] 28 약관 동의 모달
- [ ] 29 데스크탑 홈

## Motion coverage
- [ ] 51 사주 분석 로딩
- [ ] 52 결과 카드 등장
- [ ] 53 타로 카드 플립
- [ ] 54 코인 충전 성공
- [ ] 55 페이지 전환
- [ ] 56 모달 등장
- [ ] 57 토스트 시퀀스
- [ ] 58 푸시 알림 도착
- [ ] 59 한자 변환
- [ ] 60 로딩 스피너 6종
- [ ] 61 인풋 포커스/검증
- [ ] 62 차트 그리기
- [ ] 63 사주팔자 셔플

## Functional safety
- [ ] 기존 href 변경 없음
- [ ] Supabase auth 로직 변경 없음
- [ ] Toss/결제 로직 변경 없음
- [ ] 회원탈퇴/알림/상담 예약 위험 액션은 stub에서 disabled
- [ ] footer 법적 정보 보존
- [ ] 운세/사주 해석에 단정·보장·건강 진단 표현 없음

## Responsive / accessibility
- [ ] 360px
- [ ] 390px
- [ ] 768px
- [ ] 1024px
- [ ] 1280px
- [ ] 1440px
- [ ] keyboard navigation
- [ ] focus ring
- [ ] aria-label
- [ ] contrast
- [ ] prefers-reduced-motion

## Commands
- [ ] lint
- [ ] typecheck
- [ ] test
- [ ] build
