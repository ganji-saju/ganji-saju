-- 2026-05-18: 기존 /terms /privacy 페이지의 hardcoded 본문을 policy_versions v1.0.0 으로 import.
-- 새 PolicyPage 패턴 (DB 기반 markdown 렌더링) 으로 전환 시 사이트 행동 유지 (PolicyNotReady fallback 방지).
-- 운영자는 /admin/policies 에서 본문 수정 가능 (v1.0.1+ 신규 버전 생성).

create extension if not exists pgcrypto;

-- 이용약관 v1.0.0 ────────────────────────────────────────────────────────────
with payload as (
  select
    'terms'::text as kind,
    'v1.0.0'::text as version,
    '2026-05-18'::date as effective_date,
    $$## 1. 서비스 개요

간지사주는 사용자가 입력한 생년월일시를 바탕으로 사주 분석 결과와 부가 콘텐츠를 제공하는 웹 서비스입니다.

서비스는 무료 기능과 코인 기반 유료 기능으로 구성되며, 운영상 필요에 따라 기능과 가격 정책은 변경될 수 있습니다.

## 2. 계정 및 로그인

로그인은 카카오 또는 Google 계정을 통해 진행되며, 사용자는 본인 명의의 계정으로만 서비스를 이용해야 합니다.

부정확한 계정 정보 사용, 타인 계정 도용, 서비스 운영 방해 행위가 확인되면 이용이 제한될 수 있습니다.

## 3. 코인 및 결제

코인은 분야별 깊이보기, AI 상담, 궁합 분석 등 유료 기능 이용 시 차감됩니다.

결제는 외부 결제대행사를 통해 처리되며, 환불 및 취소는 관련 법령과 결제수단 정책, 그리고 서비스 운영 기준에 따라 처리됩니다.

프로모션 또는 가입 혜택으로 지급된 무료 코인은 별도 고지 없이 만료되거나 정책 변경 대상이 될 수 있습니다.

## 4. 사용자 입력 정보와 결과 이용

사용자는 본인이 입력한 생년월일시 정보에 대한 책임을 부담하며, 오입력으로 인한 결과 차이는 서비스 책임 범위에 포함되지 않습니다.

서비스에서 제공하는 사주 해석과 운세 정보는 참고용 콘텐츠이며, 의료·법률·투자 등 전문 판단을 대체하지 않습니다.

## 5. 이용 제한 및 면책

자동화된 비정상 요청, 결제 시스템 악용, 콘텐츠 무단 복제·재판매 등은 금지됩니다.

천재지변, 외부 인증/결제 서비스 장애, 통신 환경 문제 등 회사가 통제하기 어려운 사유로 발생한 손해에 대해서는 책임이 제한될 수 있습니다.

## 6. 문의

약관 관련 문의나 서비스 운영 문의가 있는 경우, 서비스 내 별도 안내 채널 또는 운영자가 고지한 연락 수단을 통해 접수할 수 있습니다.$$::text as content
)
insert into public.policy_versions (
  kind, version, effective_date, content, content_format, content_hash, requires_reconsent, changelog
)
select
  kind,
  version,
  effective_date,
  content,
  'markdown',
  encode(digest(content::bytea, 'sha256'), 'hex'),
  false,
  '기존 /terms 페이지 hardcoded 본문 import (2026-05-18 Phase 3-B seed). 운영자가 /admin/policies 에서 v1.0.1+ 으로 갱신 가능.'
from payload
on conflict (kind, version) do nothing;

-- 개인정보처리방침 v1.0.0 ──────────────────────────────────────────────────
with payload as (
  select
    'privacy'::text as kind,
    'v1.0.0'::text as version,
    '2026-05-18'::date as effective_date,
    $$## 1. 수집하는 정보

로그인 과정에서 카카오 또는 Google을 통해 제공되는 계정 식별 정보와 이메일 등 인증에 필요한 최소한의 정보를 처리할 수 있습니다.

서비스 이용 과정에서 사용자가 입력한 생년월일시, 성별, 코인 사용 이력, 결제 결과 정보가 저장될 수 있습니다.

## 2. 이용 목적

사주 분석 결과 제공, 유료 기능 이용 처리, 코인 잔액 관리, 결제 확인 및 고객 문의 대응을 위해 정보를 이용합니다.

서비스 안정성 확보와 부정 이용 방지를 위해 최소한의 로그 및 이용 기록을 활용할 수 있습니다.

## 3. 보관 및 삭제

법령상 보관 의무가 있는 정보를 제외한 개인정보는 서비스 운영 목적 달성 후 지체 없이 파기하는 것을 원칙으로 합니다.

사용자가 계정 삭제 또는 정보 삭제를 요청하는 경우, 관련 법령과 결제 분쟁 대응에 필요한 범위를 제외하고 삭제 절차를 진행할 수 있습니다.

## 4. 제3자 제공 및 처리 위탁

로그인 기능을 위해 외부 인증 제공자와 연동되며, 결제 처리를 위해 결제대행사 및 관련 인프라 서비스가 사용될 수 있습니다.

서비스 운영에 필요한 범위를 넘어 개인정보를 임의로 판매하거나 제공하지 않습니다.

## 5. 이용자 권리

이용자는 본인의 개인정보 열람, 정정, 삭제, 처리 정지 등을 요청할 수 있습니다.

요청이 있는 경우 법령상 제한 사유가 없는 범위에서 합리적인 기간 내 처리합니다.

## 6. 보호 조치

운영자는 접근 통제, 인증 정보 보호, 최소 권한 원칙 등 합리적인 수준의 보호 조치를 적용하기 위해 노력합니다.

다만 인터넷 환경의 특성상 절대적인 보안을 보장할 수는 없으므로, 이용자도 계정 보안에 주의해야 합니다.$$::text as content
)
insert into public.policy_versions (
  kind, version, effective_date, content, content_format, content_hash, requires_reconsent, changelog
)
select
  kind,
  version,
  effective_date,
  content,
  'markdown',
  encode(digest(content::bytea, 'sha256'), 'hex'),
  false,
  '기존 /privacy 페이지 hardcoded 본문 import (2026-05-18 Phase 3-B seed). 운영자가 /admin/policies 에서 v1.0.1+ 으로 갱신 가능.'
from payload
on conflict (kind, version) do nothing;
