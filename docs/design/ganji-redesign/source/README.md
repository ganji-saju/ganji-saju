# 간지사주 리디자인 Claude Code 지시서 패키지

생성 목적: 첨부 handoff zip의 `간지사주 리디자인.html` 디자인을 Claude Code가 누락 없이 적용하도록 단계별 지시서를 제공한다.

## 포함 파일

- `00_MASTER_CLAUDE_CODE_PROMPT.md` — 한 번에 전달 가능한 전체 지시문
- `01_PHASED_PROMPTS.md` — Phase별로 순차 전달할 지시문
- `02_BOARD_MANIFEST.md` — HTML에서 추출한 전체 보드 매니페스트
- `03_MOTION_IMPLEMENTATION_SPEC.md` — 13개 모션 보드 구현 스펙
- `04_FUTURE_PAGE_IMPLEMENTATION_GUIDE.md` — 미구현 페이지 shell/stub 및 추후 기능 구현 문서화 방법
- `05_QA_ACCEPTANCE_CHECKLIST.md` — 최종 검수 체크리스트

## 추출 결과

- 전체 artboard: 65개
- 모션 artboard: 13개
- 정적/시스템/컴포넌트/페이지 artboard: 52개

사용자가 지정한 “34개 정적 보드 + 13개 모션 보드”는 실제 구현 대상 범위로 취급하고, HTML에 추가로 포함된 디자인 시스템/컴포넌트/시스템/디바이스 보드는 누락 방지용 참조 보드로 관리한다.
