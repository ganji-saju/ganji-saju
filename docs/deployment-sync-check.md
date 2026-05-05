# 배포 싱크 확인 기록

작성일: 2026-05-05 KST

## 기준

- 기준 로컬 저장소: `/Users/kionya/ganji-saju`
- 기준 Git remote: `git@github.com-ganji-saju:ganji-saju/ganji-saju.git`
- 기준 브랜치: `main`
- 기준 Vercel 프로젝트: `ganji-saju`
- 기준 공개 도메인: `https://ganji-saju.vercel.app`

## Vercel Production 확인

`vercel inspect https://ganji-saju.vercel.app --scope ganji-sajus-projects` 기준:

| 항목 | 값 |
| --- | --- |
| Vercel project | `ganji-saju` |
| deployment id | `dpl_FZvuFC1hUVsxn4rsR6rxMG64ZGvc` |
| target | `production` |
| status | `READY` |
| deployment URL | `https://ganji-saju-ny64abcgm-ganji-sajus-projects.vercel.app` |
| production alias | `https://ganji-saju.vercel.app` |
| secondary aliases | `https://ganji-saju-ganji-sajus-projects.vercel.app`, `https://ganji-saju-ganji-saju-ganji-sajus-projects.vercel.app` |

## 로컬 Git 확인

| 항목 | 값 |
| --- | --- |
| local branch | `main` |
| local HEAD at audit time | `014658f80efaedc92000f7f9f05c53bacf22bf86` |
| origin | `git@github.com-ganji-saju:ganji-saju/ganji-saju.git` |
| upstream | `https://github.com/kionya/saju-app.git` fetch only, push disabled |

## 해석

- `ganji-saju.vercel.app`은 `ganji-saju` Vercel 프로젝트의 production alias를 보고 있다.
- 이 작업의 기준은 `ganji-saju/ganji-saju` 프로젝트이며, 기존 `kionya/saju-app`은 이번 배포 기준에서 제외한다.
- Vercel inspect JSON에는 git branch/commit 메타데이터가 노출되지 않았다. 따라서 commit 단위 싱크는 배포 직후 Vercel deployment id와 로컬/원격 `main` HEAD를 함께 기록해 확인한다.

## 운영 체크 TODO

- production 재배포 후 `vercel inspect https://ganji-saju.vercel.app --scope ganji-sajus-projects`로 새 deployment id 확인
- GitHub `ganji-saju/ganji-saju` main HEAD와 배포 시점 commit을 함께 기록
- 자동 alias로 로그인/OAuth가 이동하지 않도록 `NEXT_PUBLIC_SITE_URL=https://ganji-saju.vercel.app` 유지
