<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Claude Code · Codex 공통 작업 환경

- 어휘가 충돌하면 `docs/claude-specs/02-naming-policy.md`를 우선한다(`CLAUDE.md`와 같은 기준).
- 세션 시작 시 `PROGRESS.md`의 **상단 최신 기록**을 읽고 실제 Git/PR 상태와 대조한다. 오래된 인계 섹션의 머지 대기·수정 지시를 그대로 재실행하지 않는다.
- Codex 초기 설정은 `./scripts/setup-codex.sh`, 실행·검증은 `./scripts/with-node22.sh npm ...`을 사용한다. `.nvmrc`와 `package.json`의 Node 22를 지키고 전역 Node 설정을 바꾸지 않는다.
- `.env.local`·`.env.development.local`은 현재 체크아웃의 기존 파일을 사용한다. 값을 출력하거나 커밋하지 않는다. 워크트리는 아래 설정 스크립트로 같은 저장소의 파일만 연결한다.
- Codex 인계 기준·실행 방법·남은 작업은 `docs/codex-handoff.md`를 참조한다. 작업 기록은 Claude/Codex 모두 이 저장소의 `PROGRESS.md`에 남긴다.
- PROGRESS를 갱신한 작업은 끝내기 전에 `./scripts/with-node22.sh npm run progress:html`로 로컬 HTML도 갱신한다. Codex Stop 훅은 같은 작업을 보조하며, 훅 최초 신뢰 승인이 필요할 수 있다.
- 다른 프로젝트 파일·대화·Harness 공유 메모리는 명시적 승인 없이 조회·동기화하지 않는다.
- PR 머지 전 워크플로 실행 결과뿐 아니라 `./scripts/gh-ganji pr checks <번호>`의 **CodeQL 요약 체크**도 확인한다.

# 워크트리 세션(Orca 포함): 시작 전에 `./scripts/setup-worktree.sh` 1회 실행

워크트리에는 gitignore 파일(.env.local, .claude/settings.local.json)이 없고, Claude 메모리도
폴더 경로별로 갈려서 빈 상태로 시작한다(2026-08-31 실측 — PROGRESS 기록이 세션 간에 갈린 원인).
이 스크립트가 셋 다 메인 체크아웃에 심링크로 붙여 터미널 세션과 같은 환경을 만든다(멱등).
작업 기록은 아래 "PROGRESS.md 는 항상 커밋한다" 규칙을 따른다.

# GitHub 계정: 이 저장소는 항상 `ganji-saju` 로만 작업

이 저장소의 push/PR/머지는 **반드시 `ganji-saju` 계정**으로 해야 한다(기본 활성 계정 `kionya` 는 비협업자라 실패). `gh` 는 전역 활성 계정을 공유하므로 다른 프로젝트/프로세스가 계정을 바꾸면 여기도 깨진다 — 아래로 격리한다.

- **gh 명령(PR 생성·머지·조회 등)**: `./scripts/gh-ganji <args>` 래퍼를 사용한다(전역 활성 계정과 무관하게 keyring 의 ganji-saju 토큰을 런타임 조회해 실행). 예: `./scripts/gh-ganji pr create ...`, `./scripts/gh-ganji pr merge <n> --squash`.
- **git push/fetch**: repo-local credential helper 로 이미 ganji-saju 고정. 새로 clone 하면 `./scripts/setup-project-account.sh` 를 1회 실행.
- 토큰은 파일에 저장하지 않는다(keyring 런타임 조회). `env -u GH_TOKEN -u GITHUB_TOKEN` 관례는 유지(잘못된 env 토큰 간섭 방지).

# PROGRESS.md 는 항상 커밋한다 (2026-08-31 결정)

작업 기록은 루트 `PROGRESS.md` **맨 위에 새 섹션**으로만 추가하고 옛 섹션은 건드리지 않는다. 그 기록은 **그 작업의 PR 에 같이 커밋**한다(미커밋으로 두지 않는다). 세션 시작 시 `git pull` 로 최신 PROGRESS 를 먼저 받는다.

- 이유: 세션이 여러 폴더(git worktree — Orca 세션 포함)에서 돌면 미커밋 기록은 서로 안 보여 갈린다. 2026-08-31 에 실제로 갈렸고(커밋본 4,277줄 vs 작업본 5,761줄), 일주일치 기록이 노트북 한 곳에만 있었다.
- 갈렸으면: 원격이 추가한 섹션을 작업본 상단에 끼워 넣는다(작업본이 상위집합인지 `## 20` 헤더 목록으로 대조).
