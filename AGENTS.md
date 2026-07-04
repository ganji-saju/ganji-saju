<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# GitHub 계정: 이 저장소는 항상 `ganji-saju` 로만 작업

이 저장소의 push/PR/머지는 **반드시 `ganji-saju` 계정**으로 해야 한다(기본 활성 계정 `kionya` 는 비협업자라 실패). `gh` 는 전역 활성 계정을 공유하므로 다른 프로젝트/프로세스가 계정을 바꾸면 여기도 깨진다 — 아래로 격리한다.

- **gh 명령(PR 생성·머지·조회 등)**: `./scripts/gh-ganji <args>` 래퍼를 사용한다(전역 활성 계정과 무관하게 keyring 의 ganji-saju 토큰을 런타임 조회해 실행). 예: `./scripts/gh-ganji pr create ...`, `./scripts/gh-ganji pr merge <n> --squash`.
- **git push/fetch**: repo-local credential helper 로 이미 ganji-saju 고정. 새로 clone 하면 `./scripts/setup-project-account.sh` 를 1회 실행.
- 토큰은 파일에 저장하지 않는다(keyring 런타임 조회). `env -u GH_TOKEN -u GITHUB_TOKEN` 관례는 유지(잘못된 env 토큰 간섭 방지).
