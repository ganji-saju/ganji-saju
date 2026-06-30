# Codebase Memory (코드 지식그래프) — 협업자 셋업

이 저장소는 **codebase-memory-mcp** 로 코드 구조를 지식그래프로 인덱싱해, AI 에이전트(Claude Code 등)가
"누가 이 함수를 호출하나 / 이 변경의 영향 범위 / 죽은 코드 / 호출 체인 / 아키텍처"를 빠르게 답하도록 한다.

- 100% 로컬 실행: **API 키 불필요, 외부 전송 없음, DB·LSP 설치 불필요**(단일 바이너리 + 벤더 SQLite).
- 인덱스는 **각자 PC 로컬 캐시**(`~/.cache/codebase-memory-mcp`)에 저장된다. 저장소에 커밋하지 않는다
  (현재 버전 v0.8.1 은 공유 아티팩트(persistence) 미지원 — 각자 1회 인덱싱이 가장 간단).

## 1) 설치 (1회)

macOS / Linux:
```bash
curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash
```
Windows(PowerShell):
```powershell
Invoke-WebRequest -Uri https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.ps1 -OutFile install.ps1; .\install.ps1
```
설치 스크립트가 Claude Code 등 에이전트의 MCP 설정을 자동 등록한다. (그 외: npm / Homebrew / Scoop / AUR / `go install` 등도 지원.)
설치 후 에이전트를 재시작하면 `mcp__codebase-memory-mcp__*` 도구가 붙는다.

## 2) 이 저장소 인덱싱 (최초 1회 + 큰 변경 후)

에이전트 안에서:
```
index_repository(repo_path="<이 저장소 절대경로>", mode="full")
```
또는 터미널 CLI:
```bash
codebase-memory-mcp cli index_repository '{"repo_path":"'"$(pwd)"'","mode":"full"}'
```
- `mode`: `full`(전체+의미엣지, 권장) / `moderate` / `fast`. node_modules·.next·.git·.superpowers 등은 자동 제외.
- 세션 시작 시 자동 인덱싱을 원하면: `codebase-memory-mcp config set auto_index true`
- 인덱스는 **스냅샷**이라 리팩터·기능 추가 등 큰 변경 후 재인덱싱해야 최신화된다.

## 3) 사용

구조적 질문을 하면 에이전트가 그래프를 활용한다. 예:
- "누가 `deductCredits` 를 호출해?" / "`getMemberTier` 바꾸면 영향 범위는?"
- "결제 흐름 호출 체인 추적" / "안 쓰이는 함수(죽은 코드) 찾기" / "아키텍처 개요·모듈 구조"

평소 grep/파일읽기보다 호출관계·의존성·영향분석에서 빠르고 정확하다.

> 참고: 인덱스는 로컬 전용이므로 팀원마다 한 번씩 인덱싱하면 된다. 공유 아티팩트 부트스트랩(persistence)은
> 상위 버전에서 지원되며, 도입 시 본 문서를 갱신한다.
