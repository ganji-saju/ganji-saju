#!/bin/sh
# Codex 프로젝트 환경 — 전역 Node 설정을 바꾸지 않고 Node 22를 준비한다.
set -eu

repo=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
cd "$repo"

./scripts/setup-worktree.sh

runtime="$repo/.codex-run/node22"
node_bin="$runtime/node_modules/node/bin/node"
node_major=''
if [ -x "$node_bin" ]; then
  node_major=$("$node_bin" -p 'process.versions.node.split(".")[0]' 2>/dev/null || true)
fi

if [ "$node_major" != '22' ]; then
  if ! command -v npm >/dev/null 2>&1; then
    echo "setup-codex: Node 22를 준비하려면 기존 Node/npm 실행 환경이 필요합니다." >&2
    exit 1
  fi
  npm install --prefix "$runtime" --no-save --package-lock=false --no-audit --no-fund node@22
fi

if [ ! -x "$node_bin" ] || [ "$("$node_bin" -p 'process.versions.node.split(".")[0]' 2>/dev/null || true)" != '22' ]; then
  echo "setup-codex: 프로젝트 Node 22 실행 파일을 확인할 수 없습니다: $node_bin" >&2
  exit 1
fi
PATH="$(dirname "$node_bin"):$PATH"
export PATH

if [ ! -d "$repo/node_modules" ]; then
  npm ci --no-audit --no-fund
fi

node_version=$(node --version)
npm_version=$(npm --version)
printf '프로젝트 준비 완료: Node %s / npm %s\n' "$node_version" "$npm_version"
echo '개발 서버: ./scripts/with-node22.sh npm run dev'
echo '타입 검사: ./scripts/with-node22.sh npm run typecheck'
echo '단위 테스트: ./scripts/with-node22.sh npm test'
echo '스펙 테스트: ./scripts/with-node22.sh npm run test:spec'
