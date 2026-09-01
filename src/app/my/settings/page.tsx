// Redesign 2026-05-15 — 설정 페이지를 sub-page 디자인(pink-soft hero + 1열 카드)으로 재작성.
// 이전엔 PageHero + SectionSurface 같은 옛 marketing 컴포넌트로 사이트와 어긋남.
// 명시적 섹션: 알림 / 레이아웃 / 읽기 경험 / 가족·다른 사람 정보 / 계정 관리.
//
// 2026-05-16 — PR #155/#159 가 PC SiteHeader 의 사이드바를 가린 뒤로
// ReadingComfort 토글 / 로그아웃 진입점이 PC 에서 사라졌다.
// 우상단 avatar(메가 메뉴) → /my → /my/settings 경로로 통합하기 위해
// 본 페이지에 ReadingComfortControl 카드와 LogoutButton 을 합류시킨다.
import Link from 'next/link';
import { InkIcon } from '@/components/gangi/ink-icons';
import { LogoutButton } from '@/features/account/logout-button';
import { KakaoContactCard } from '@/features/account/kakao-contact-card';
import { isKakaoSendConfigured, kakaoConfig } from '@/lib/kakao/config';
// Task 8 — 카카오 친구추가 무료쿠폰 CTA(마이/설정 진입점). slug 없이 렌더 —
// 휴면(KAKAO_FRIEND_COUPON_ENABLED off)이면 컴포넌트 자체가 아무것도 렌더하지 않는다.
import { KakaoFriendCouponCta } from '@/features/coupons/kakao-friend-coupon-cta';

const QUICK_LINK_TONE = {
  pink: {
    background: 'var(--app-pink-soft)',
    border: 'var(--app-pink-line)',
    icon: 'var(--app-pink-strong)',
    label: 'var(--app-pink-strong)',
  },
  jade: {
    background: '#e8f5ee',
    border: 'rgba(45,135,88,0.22)',
    icon: 'var(--app-jade)',
    label: 'var(--app-jade)',
  },
  indigo: {
    background: '#eef0fb',
    border: 'rgba(74,92,184,0.22)',
    icon: '#4a5cb8',
    label: '#4a5cb8',
  },
  amber: {
    background: '#fff7e6',
    border: 'rgba(212,148,38,0.28)',
    icon: 'var(--app-amber)',
    label: 'var(--app-amber)',
  },
} as const;

interface QuickLinkProps {
  icon: string;
  label: string;
  desc: string;
  href: string;
  tone: keyof typeof QUICK_LINK_TONE;
}

function QuickLink({ icon, label, desc, href, tone }: QuickLinkProps) {
  const palette = QUICK_LINK_TONE[tone];
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-[14px] border bg-white p-3.5"
      style={{ borderColor: 'var(--app-line)' }}
    >
      <div
        className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] text-[20.7px]"
        style={{
          background: palette.background,
          border: `1px solid ${palette.border}`,
          color: palette.icon,
        }}
        aria-hidden="true"
      >
        {/* 🔴 2026-09-01 — 전엔 {icon} 을 그대로 렌더해서 화면에 'pen' 'bell' 'chat' 이
            **영어 단어 그대로** 20px 로 찍혀 있었다(#753 먹선 아이콘 스윕이 이 파일만
            빠뜨렸다 — 이름은 전부 ICONS 에 이미 있었다). */}
        <InkIcon name={icon} size={21} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[16.1px] font-extrabold text-[var(--app-ink)]" style={{ wordBreak: 'keep-all' }}>
          {label}
        </div>
        <div
          className="mt-0.5 text-[13.2px] text-[var(--app-copy-soft)]"
          style={{ wordBreak: 'keep-all' }}
        >
          {desc}
        </div>
      </div>
      <span className="text-[var(--app-copy-soft)]" aria-hidden="true">
        ›
      </span>
    </Link>
  );
}

export default function MySettingsPage() {
  return (
    <div className="space-y-5 px-1">
      {/* §Hero — pink-soft */}
      <article
        className="rounded-[18px] border p-5"
        style={{
          background: 'var(--app-pink-soft)',
          borderColor: 'var(--app-pink-line)',
        }}
      >
        <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
          설정
        </div>
        <h1
          className="mt-1.5 text-[25.3px] font-extrabold leading-snug tracking-tight text-[var(--app-ink)]"
          style={{ wordBreak: 'keep-all' }}
        >
          내 정보와 알림을
          <br />
          여기서 정리하세요
        </h1>
        <p
          className="mt-2 text-[14.4px] leading-[1.6] text-[var(--app-copy-muted)]"
          style={{ wordBreak: 'keep-all' }}
        >
          프로필·가족 정보부터 알림 시간, 문의와 계정 관리까지 한곳에 모았어요.
        </p>
      </article>

      {/* Task 8 — 카카오 친구추가 무료쿠폰 CTA. 휴면(KAKAO_FRIEND_COUPON_ENABLED off)이면
          컴포넌트 자체가 아무것도 렌더하지 않는다. */}
      <KakaoFriendCouponCta />

      {/* §정보 관리 — 가족·다른 사람 정보 / 내 정보 편집 */}
      <section>
        <h2 className="px-1 text-[12.6px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-muted)]">
          정보 관리
        </h2>
        <div className="mt-2 grid gap-2">
          <QuickLink
            icon="pen"
            label="내 정보 편집"
            desc="이름·생년월일·시간 룰을 수정합니다"
            href="/my/profile"
            tone="pink"
          />
          <QuickLink
            icon="love"
            label="가족·다른 사람 정보"
            desc="궁합·가족 리포트에 함께 쓰일 사람들을 등록·관리합니다"
            href="/my/profile#family"
            tone="pink"
          />
        </div>
      </section>

      {/* §알림 — 레이아웃 토글을 뺀 뒤로 '화면' 에 해당하는 항목이 없어 제목도 줄인다. */}
      <section>
        <h2 className="px-1 text-[12.6px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-muted)]">
          알림
        </h2>
        {/* 2026-09-01 — 전엔 '푸시·위젯·재방문 리마인더' 라고 안내했는데 알림센터에 위젯
            UI 는 없다(탭은 '받은 알림'·'알림 설정' 둘뿐). 있는 것만 말한다. */}
        <div className="mt-2 grid gap-2">
          <QuickLink
            icon="bell"
            label="알림 센터"
            desc="받은 알림 확인과 푸시 알림 시간 설정"
            href="/notifications"
            tone="indigo"
          />
        </div>
        {/* 🔴 2026-09-01 — 'PC 레이아웃 보기'(세로형/가로형) 카드를 뺐다. 아무것도 바꾸지
            않는 죽은 토글이었다: `.app-desktop-sidebar` 는 app-shell.css 에서 1024px 이상일
            때 `display:none` 이라 사이드바가 어디에도 안 뜨고, `[data-app-layout="horizontal"]`
            셀렉터는 85곳 전부 기본 셀렉터와 **묶여 있어 두 모드의 스타일이 동일**하다.
            "PC 에서만 고를 수 있습니다" 라고 써놓고 모바일에도 그대로 보이기까지 했다.
            컴포넌트(layout-preference)는 남겨 뒀으므로 되살리려면 이 블록만 복구하면 된다. */}
        {/* 카카오 알림톡 수신용 전화번호 + 광고(친구톡) 수신동의.
            발송 설정이 안 돼 있으면 카드가 약속을 하지 않는다(아래 sendingLive). */}
        <KakaoContactCard
          sendingLive={isKakaoSendConfigured() && Boolean(kakaoConfig.templates.paymentComplete)}
        />
      </section>

      {/* 2026-07-20 — §읽기 경험 섹션 숨김(사용자 요청).
          글자 크기 토글(ReadingComfortControl)과 SETTINGS_BLUEPRINT 안내 카드가 여기 있었다.
          컴포넌트·데이터는 남겨 두었으므로 이 블록만 되살리면 원복된다. */}

      {/* §고객센터 — 자주하는 질문 / 1:1 문의 (08-4 신규 진입점, 페이지는 후속 PR) */}
      <section>
        <h2 className="px-1 text-[12.6px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-muted)]">
          고객센터
        </h2>
        <div className="mt-2 grid gap-2">
          <QuickLink
            icon="student"
            label="자주하는 질문 (FAQ)"
            desc="결제·구독·결과·환불 자주 묻는 질문"
            href="/support/faq"
            tone="jade"
          />
          <QuickLink
            icon="chat"
            label="1:1 문의"
            desc="개별 질문이 있다면 직접 보내주세요"
            href="/support/contact"
            tone="jade"
          />
        </div>
      </section>

      {/* §계정 관리 — 로그아웃 (기본 톤) + 회원탈퇴 (강조 톤) */}
      <section>
        <h2 className="px-1 text-[12.6px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-muted)]">
          계정 관리
        </h2>
        <div className="mt-2 grid gap-2">
          <LogoutButton />
          <Link
            href="/my/settings/delete-account"
            className="flex items-center justify-between rounded-[14px] border bg-white p-3.5"
            style={{ borderColor: 'var(--app-line)' }}
          >
            <div className="min-w-0">
              <div className="text-[15.5px] font-extrabold text-[var(--app-coral)]">
                회원탈퇴
              </div>
              <div
                className="mt-0.5 text-[13.2px] text-[var(--app-copy-soft)]"
                style={{ wordBreak: 'keep-all' }}
              >
                탈퇴 절차와 잃게 되는 것들을 미리 확인합니다
              </div>
            </div>
            <span className="text-[var(--app-copy-soft)]" aria-hidden="true">
              ›
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}
