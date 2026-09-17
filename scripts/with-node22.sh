#!/bin/sh
# Node 22로 명령을 실행한다. 명령 인수와 호출한 작업 디렉터리를 보존한다.
set -eu

if [ "$#" -eq 0 ]; then
  echo '사용법: ./scripts/with-node22.sh <명령> [인수...]' >&2
  exit 1
fi

repo=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
node_bin="$repo/.codex-run/node22/node_modules/node/bin/node"
if [ -x "$node_bin" ]; then
  PATH="$(dirname "$node_bin"):$PATH"
  export PATH
fi

node_major=''
if command -v node >/dev/null 2>&1; then
  node_major=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || true)
fi
if [ "$node_major" != '22' ]; then
  echo "with-node22: Node 22가 필요합니다. 먼저 $repo/scripts/setup-codex.sh 를 실행하세요." >&2
  exit 1
fi

exec "$@"
