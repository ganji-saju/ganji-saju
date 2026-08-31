#!/bin/sh
# 워크트리 세션(Orca 포함) 환경 부트스트랩 — 메인 체크아웃과 같은 환경을 만든다.
#
# 워크트리는 gitignore 파일이 안 따라오고, Claude 메모리는 폴더 경로별로 갈린다.
# 이 스크립트는 셋 다 심링크로 메인에 붙인다(멱등 — 몇 번 실행해도 안전).
#   1) .env.local 등 로컬 전용 파일        → 메인 체크아웃 것을 링크
#   2) .claude/settings.local.json (훅 설정) → 메인 체크아웃 것을 링크
#   3) ~/.claude/projects/<이 워크트리>/memory → 메인 프로젝트 memory 를 링크
# node_modules 는 워크트리 생성기가 이미 만들어 주므로 없을 때만 링크한다.
set -eu

main_root=$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")
here=$(git rev-parse --path-format=absolute --show-toplevel)

if [ "$main_root" = "$here" ]; then
  echo "메인 체크아웃에서 실행됨 — 링크할 것 없음"
  exit 0
fi

link() {
  src="$1"; dst="$2"
  if [ ! -e "$src" ]; then return 0; fi
  # set -e 아래에서 `[ ] || [ ] && return` 꼴은 거짓일 때 스크립트를 죽인다 — if 로 쓴다.
  if [ -e "$dst" ] || [ -L "$dst" ]; then return 0; fi
  mkdir -p "$(dirname "$dst")"
  ln -s "$src" "$dst"
  echo "linked: $dst -> $src"
}

for f in .env.local .env.development.local; do
  link "$main_root/$f" "$here/$f"
done
link "$main_root/.claude/settings.local.json" "$here/.claude/settings.local.json"
link "$main_root/node_modules" "$here/node_modules"

# Claude 메모리 공유 — 프로젝트 디렉터리 이름 규칙: 경로의 '/'와 '.'을 '-'로 치환.
munged=$(printf '%s' "$here" | tr '/.' '--')
main_munged=$(printf '%s' "$main_root" | tr '/.' '--')
proj_dir="$HOME/.claude/projects/$munged"
main_memory="$HOME/.claude/projects/$main_munged/memory"
if [ -d "$main_memory" ]; then
  mkdir -p "$proj_dir"
  link "$main_memory" "$proj_dir/memory"
fi

echo "done"
