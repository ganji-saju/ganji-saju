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
- `.codex/hooks.json`의 `UserPromptSubmit`·`Stop` 훅이 작업 기록과 HTML 생성을 연결한다. `scripts/codex-progress-hook.mjs`는 저장소 하위 폴더에서도 루트를 찾아 실행하며 Node 22 실행기를 사용한다.
- 2026-09-17 이 컴퓨터의 보고 훅 두 개를 Codex 공식 설정 API로 신뢰 등록하고 `enabled=true`·`trustStatus=trusted`를 확인했다. 다른 컴퓨터나 변경된 정의는 `/hooks`에서 신뢰 상태를 확인한다. 수동 HTML 생성은 `./scripts/with-node22.sh npm run progress:html`이다. [Codex 훅 문서](https://learn.chatgpt.com/docs/hooks)
- 프로젝트 전용 Claude skills·commands·agents는 없었다. 전역 Claude 설정과 다른 프로젝트의 대화·메모리는 이번 인계 범위에 포함하지 않는다.

## 자동 작업 보고

1. 프롬프트가 시작되면 현재 커밋·파일 변경 상태·PROGRESS 해시를 `.codex-run/progress-hooks/`에 저장한다. 비밀값·대화 전문·파일 본문은 상태 파일에 저장하지 않는다.
2. Codex는 실제 작업 내용, 실행한 검증 결과, 남은 일을 `PROGRESS.md` 상단에 기록하고 본인 작업과 함께 커밋한다.
3. 종료 시 훅이 작업 변경과 보고서를 대조한다. 기록 누락, 기존 기록 삭제/변경, 미커밋 보고서는 한 번 자동 보완을 요청한다. 자동 보완 프롬프트에서는 처음 작업 기준점을 유지한다.
4. 보고서가 준비되면 HTML을 생성한다. 렌더 실패도 보완 대상이며, 재시도 후 해결되지 않은 문제는 경고로 표시해 무한 반복을 막는다.

기존 사용자의 변경을 그대로 둔 조회, 변경 없는 질문, 서브에이전트 종료에는 새 기록을 강제하지 않는다. 중요한 판단처럼 Git 변경이 없는 작업은 Codex가 공통 지침에 따라 기록한다. 훅은 `git add`·`git commit`을 실행하지 않으며, 같은 체크아웃에서 동시에 생긴 변경의 작성자를 판별할 수 없으므로 보고·커밋 범위는 Codex가 확인한다.

훅 정의를 바꾸면 Codex가 새 정의의 신뢰 검토를 요구할 수 있다. 최초 설정 전부터 진행 중이던 작업은 기준점이 없으므로 HTML만 생성하며, 다음 프롬프트부터 변경 감지가 시작된다.

검증 명령: `./scripts/with-node22.sh npm run test:progress-hooks`. 임시 Git 저장소에서 기록 누락·미커밋·기존 기록 보존·자동 재진입·HTML 실패를 확인하고 CI에서도 실행한다.

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
