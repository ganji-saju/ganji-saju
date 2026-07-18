# Ganji Saju — Gemini/Antigravity Operating Manual
> 사주/간지 웹 애플리케이션 개발 워크스페이스.

## 0. Authority and Scope
- Work inside this repository only: `/Users/kionya/ganji-saju`.
- If work must touch another project, ask the user for approval.

## 1. Next.js Breaking Changes (필수 주의)
- **이 프로젝트에서 사용하는 Next.js 버전은 기존 학습 데이터의 정보와 다릅니다.**
- Next.js의 라우팅 API, 컨벤션, 파일 구조 등에 브레이킹 체인지가 다수 존재하므로, 새로운 코드를 작성하기 전에 반드시 `node_modules/next/dist/docs/` 디렉토리 아래의 기술 가이드를 최우선으로 참고하십시오.

## 2. GitHub 계정 격리 규칙 (매우 중요)
- 이 저장소의 push, fetch 및 PR/머지 작업은 **반드시 `ganji-saju` 계정**으로만 실행해야 합니다. 기본 활성 계정인 `kionya`는 비협업자 권한으로 설정되어 있어 실패하게 됩니다.
- **gh CLI 명령 실행**: PR 생성, 머지, 조회 등의 모든 gh 작업 시 전역 계정에 상관없이 `./scripts/gh-ganji <args>` 래퍼 스크립트를 사용해야 합니다.
  - 예: `./scripts/gh-ganji pr create ...`
  - 예: `./scripts/gh-ganji pr merge <n> --squash`
- **git push/fetch**: 로컬 자격 증명 헬퍼가 이미 `ganji-saju`로 고정되어 있습니다. 새로 클론한 경우 `./scripts/setup-project-account.sh`를 1회 실행하여 계정을 연결하십시오.
- 토큰 정보를 절대 소스 코드나 환경 파일에 평문으로 남기지 마십시오 (keyring에서 런타임 조회). `env -u GH_TOKEN -u GITHUB_TOKEN` 관례를 유지하여 원치 않는 환경 토큰 간섭을 격리하십시오.

<!-- HARNESS-AI-MEMORY:BEGIN -->
## Harness Shared AI Memory

Codex, Claude Code, Gemini, and ChatGPT history is materialized in the shared Obsidian vault. Treat recalled notes as context, then verify important claims against current files or services.

Only use this memory automatically when the current project is harness-suite. For any other project, obtain explicit user approval before querying this Harness memory, syncing another project's files or history, or combining data across projects.

Before substantial work that may depend on prior history, run:

```bash
cd "${HARNESS_ROOT:?Set HARNESS_ROOT to the approved harness-suite root}" && tools/brain pack "task or question"
```

After approved Harness-local AI sessions change, refresh the bridge. Before running this command, verify its configured sources contain only projects the user approved:

```bash
cd "${HARNESS_ROOT:?Set HARNESS_ROOT to the approved harness-suite root}" && tools/sync_ai_memory.sh
```

For file-to-conversation handoff, query the memory pack with the task and file path, and consult `brain-vault/knowledge/00_지도_MOC/AI_FILE_CONVERSATION_MAP.md`. Never hand-edit generated notes under `brain-vault/domains/**`.
<!-- HARNESS-AI-MEMORY:END -->
