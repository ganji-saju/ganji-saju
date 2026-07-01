-- 058_rename_coin_to_jeon_in_policies.sql
-- 날짜: 2026-07-01
-- 목적: 재화 명칭 리브랜딩("코인" → "전")의 DB 반영.
--       정책 본문(약관/개인정보/환불/코인정책 등)은 policy_versions(DB)에서 우선
--       서빙된다(032 seed / 운영자 /admin/policies 편집). 코드 치환(PR #573)만으로는
--       라이브 법률·코인정책 페이지 텍스트가 바뀌지 않으므로, 여기서 DB 본문을
--       in-place 치환한다.
--
-- 범위: policy_versions.content 의 한국어 "코인" → "전".
--       - 정책 문서의 "코인"은 전부 재화 명칭(유료 기능 차감·무료 지급 등)이며
--         가상화폐/투기 의미는 없다(있으면 이 마이그레이션 재검토 필요).
--       - content 변경 시 content_hash(SHA-256 무결성)를 반드시 재계산한다.
--       - kind 값('coin')·version·effective_date·라우트(/coin-policy) 등 식별자는 불변.
--       - changelog(운영자 내부 메모·이력)는 역사성 유지를 위해 건드리지 않는다.
--
-- 성격: 재화 이름 표기 변경(오탈자성 편집)으로 실질 법적 내용 변경 아님 →
--       신규 버전 발급/재동의(requires_reconsent) 없이 현 버전 본문을 in-place 갱신.
--
-- ⚠️ 프로덕션 적용: 057과 동일하게 배포 체크리스트에 따라 수동 적용.
--    이 파일만 커밋; 원격 DB 자동 적용 안 함.

create extension if not exists pgcrypto;

update public.policy_versions
set
  content = replace(content, '코인', '전'),
  content_hash = encode(digest(replace(content, '코인', '전')::bytea, 'sha256'), 'hex')
where content like '%코인%';
