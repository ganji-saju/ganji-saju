#!/usr/bin/env bash
# 이 저장소의 git 인증을 ganji-saju 계정으로 고정한다(clone 후 1회 실행).
#
# 배경: gh 는 전역 활성 계정(~/.config/gh/hosts.yml)을 공유하므로, 다른 프로젝트/
#   프로세스가 `gh auth switch` 로 계정을 바꾸면 이 저장소의 push/PR 도 그 계정으로
#   나가 "must be a collaborator" 로 실패한다. 이 스크립트는 repo-local git credential
#   helper 를 ganji-saju 로 고정해 전역 상태와 무관하게 만든다.
#   (gh CLI 명령은 scripts/gh-ganji 래퍼를 사용 — PR/머지 등.)
#
# 토큰은 파일에 저장하지 않고, keyring 의 ganji-saju 토큰을 매 요청 런타임 조회한다.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

git config --local credential."https://github.com".username ganji-saju
git config --local credential.helper \
  '!f() { test "$1" = get && echo "username=ganji-saju" && echo "password=$(env -u GH_TOKEN -u GITHUB_TOKEN gh auth token --user ganji-saju)"; }; f'

echo "✓ 이 저장소 git 인증을 ganji-saju 로 고정했습니다(전역 gh 활성 계정과 무관)."
echo "  gh 명령(PR/머지 등)은 ./scripts/gh-ganji 를 사용하세요."
echo "  확인: printf 'protocol=https\\nhost=github.com\\n\\n' | git credential fill | grep username"
