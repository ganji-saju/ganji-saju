# 간지사주 Codex 인계

확인일: 2026-09-17. Claude Code와 Codex가 같은 저장소와 작업 기록을 사용한다.

## 동기화 기준

- 작업 폴더: `/Users/kionya/ganji-saju`.
- 원격: `https://github.com/ganji-saju/ganji-saju.git` (`origin`). `upstream`은 원본 저장소이며 이번 인계 대상이 아니다.
- 인계 시 `git pull --ff-only origin main` 결과 최신 상태. 원격 `main`·`staging`과 로컬 기준 커밋은 모두 `0d361e0e470a2e5ca28afc83370fd35d9e8ff91e`.
- 마지막 제품 코드 커밋은 `2467140a`(#827). 그 다음 #830은 작업 인계 문서 커밋이다. 이번 Codex 설정은 그 위의 별도 `codex/claude-handoff-setup` 브랜치에 기록한다.
- 같은 저장소의 Claude 워크트리 31개는 모두 미커밋 변경이 없었다. squash 머지 전 브랜치의 그래프 차이는 새 작업으로 간주하지 않는다.
- `.env.local`, `.env.development.local`, 기존 `node_modules`를 그대로 사용한다. 토큰과 환경변수 값을 복사하거나 문서에 기록하지 않는다.

## 실행

```sh
./scripts/setup-codex.sh
./scripts/with-node22.sh npm run dev -- --port 3000
```

Codex 앱의 로컬 환경에는 같은 명령의 **개발 서버·타입 검사·단위 테스트·스펙 테스트** 액션을 등록했다(`.codex/environments/environment.toml`). 새 워크트리에서는 초기 설정 스크립트를 사용한다.

초기 설정은 이 저장소의 무시된 `.codex-run/node22`에 Node 22를 설치한다. 전역 Node 버전은 바꾸지 않는다. 이미 있는 루트 의존성은 유지하고, 새 워크트리처럼 `node_modules`가 없을 때만 `npm ci`를 실행한다. 워크트리의 로컬 환경파일은 기존 `setup-worktree.sh`로 같은 저장소의 메인 체크아웃에 연결한다.

```sh
./scripts/with-node22.sh npm run typecheck
./scripts/with-node22.sh npm test
./scripts/with-node22.sh npm run test:spec
```

`npm run e2e` 전체 실행에는 로그인·결제 테스트의 데이터 준비/정리가 포함된다. 단순 환경 확인은 위 검증과 비로그인 로컬 페이지 확인으로 한다. staging과 로컬 환경이 운영 Supabase에 연결될 수 있으므로 멤버십·결제·마이그레이션 작업 전 대상 환경을 확인한다(`docs/membership-period-ledger-design.md`).

## 지침과 도구

- `AGENTS.md`가 Claude Code와 Codex의 공통 지침이다. `CLAUDE.md`의 어휘 정책 우선 규칙도 반영했다. 자동 변환기의 `AGENTS.md → CLAUDE.md → AGENTS.md` 순환 참조는 적용하지 않았다.
- GitHub 작업은 `./scripts/gh-ganji`로 `ganji-saju` 계정을 사용한다. 다른 프로젝트의 전역 활성 계정을 바꾸지 않는다.
- `.mcp.json`의 Supabase 연결을 프로젝트 `.codex/config.toml`에 옮겼다. `.claude/settings.local.json`에 있던 **비활성화 상태**를 유지한다. 인증은 `SUPABASE_ACCESS_TOKEN` 환경변수 참조이며 값은 저장하지 않는다.
- 전역 Apify MCP는 이번 인계 전에 별도로 등록·로그인한 설정을 그대로 사용한다.
- `.claude/settings.local.json`의 작업 종료 시 PROGRESS HTML 생성 기능을 `.codex/hooks.json`에 옮겼다. 저장소 하위 폴더에서도 루트를 찾아 실행하며 Node 22 실행기를 사용한다.
- 새 Codex 훅은 `/hooks`에서 현재 정의를 최초 검토·신뢰해야 자동 실행될 수 있다. 승인 전에도 `./scripts/with-node22.sh npm run progress:html`로 동일한 로컬 보고서를 만든다. [Codex 훅 문서](https://learn.chatgpt.com/docs/hooks)
- 프로젝트 전용 Claude skills·commands·agents는 없었다. 전역 Claude 설정과 다른 프로젝트의 대화·메모리는 이번 인계 범위에 포함하지 않는다.

## 이어서 볼 작업

2026-09-17 GitHub 조회 기준이며, 실제 작업 전 다시 확인한다.

- #829·#828·#827은 이미 머지됐다. `PROGRESS.md`의 예전 “머지 대기” 섹션과 #827 키 해시 수정 지시는 상단 완료·정정 기록으로 대체됐다.
- [#831 관리자 환불 동시 승인 선점](https://github.com/ganji-saju/ganji-saju/pull/831)은 OPEN, 사용자 판단 대기. 이번 설정 작업에서는 머지하지 않았다.
- [#822 Dependabot 의존성 업데이트](https://github.com/ganji-saju/ganji-saju/pull/822)도 OPEN. 현재 lockfile과 의존성 버전을 유지했다.
- 나이스 재조회 불일치 시 재시도 정책, 부분환불의 결제내역/LTV 반영, 다음 날 재구매 시 이전 이용권 처리, staging QA는 `PROGRESS.md`의 2026-09-15 최신 후속 목록을 참조한다.

## 세션 시작과 종료

1. 현재 브랜치와 미커밋 변경을 확인하고, 기존 작업을 보존하며 최신 원격 상태를 가져온다.
2. `AGENTS.md`, `PROGRESS.md` 상단, 해당 기능 문서를 읽는다. 커밋/PR 상태로 옛 인계 기록을 검증한다.
3. Node 22 실행기로 작업과 필요한 검증을 한다. Next 코드를 변경할 때는 설치된 `node_modules/next/dist/docs/`를 먼저 읽는다.
4. `PROGRESS.md` 맨 위에 새 기록을 추가하고 작업 커밋/PR에 포함한다. `PROGRESS.html`은 로컬에서 갱신하되 커밋하지 않는다.
