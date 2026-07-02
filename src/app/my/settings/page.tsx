// Redesign 2026-05-15 — 설정 페이지를 sub-page 디자인(pink-soft hero + 1열 카드)으로 재작성.
// 이전엔 PageHero + SectionSurface 같은 옛 marketing 컴포넌트로 사이트와 어긋남.
// 명시적 섹션: 알림 / 레이아웃 / 읽기 경험 / 가족·다른 사람 정보 / 계정 관리.
//
// 2026-05-16 — PR #155/#159 가 PC SiteHeader 의 사이드바를 가린 뒤로
// ReadingComfort 토글 / 로그아웃 진입점이 PC 에서 사라졌다.
// 우상단 avatar(메가 메뉴) → /my → /my/settings 경로로 통합하기 위해
// 본 페이지에 ReadingComfortControl 카드와 LogoutButton 을 합류시킨다.
import Link from 'next/link';
import { SETTINGS_BLUEPRINT } from '@/content/moonlight';
import { LayoutModeControl } from '@/features/layout-preference/layout-mode-control';
import { ReadingComfortControl } from '@/features/layout-preference/reading-comfort-control';
import { LogoutButton } from '@/features/account/logout-button';
import { KakaoContactCard } from '@/features/account/kakao-contact-card';

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
        {icon}
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
          알림 · 글자 · 레이아웃을
          <br />
          편한 대로 맞춰주세요
        </h1>
        <p
          className="mt-2 text-[14.4px] leading-[1.6] text-[var(--app-copy-muted)]"
          style={{ wordBreak: 'keep-all' }}
        >
          자주 읽기 어렵다면 글자 크기를, 시간대가 안 맞으면 알림 시간을 바꿔보세요.
        </p>
      </article>

      {/* §정보 관리 — 가족·다른 사람 정보 / 내 정보 편집 */}
      <section>
        <h2 className="px-1 text-[12.6px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-muted)]">
          정보 관리
        </h2>
        <div className="mt-2 grid gap-2">
          <QuickLink
            icon="✎"
            label="내 정보 편집"
            desc="이름·생년월일·시간 룰을 수정합니다"
            href="/my/profile"
            tone="pink"
          />
          <QuickLink
            icon="♥"
            label="가족·다른 사람 정보"
            desc="궁합·가족 리포트에 함께 쓰일 사람들을 등록·관리합니다"
            href="/my/profile#family"
            tone="pink"
          />
        </div>
      </section>

      {/* §알림 / 위젯 / 레이아웃 */}
      <section>
        <h2 className="px-1 text-[12.6px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-muted)]">
          알림 · 화면
        </h2>
        <div className="mt-2 grid gap-2">
          <QuickLink
            icon="🔔"
            label="알림 센터"
            desc="푸시·위젯·재방문 리마인더 시간 조정"
            href="/notifications"
            tone="indigo"
          />
        </div>
        {/* PC 레이아웃 옵션은 LayoutModeControl 컴포넌트 그대로 */}
        <article
          className="mt-2 rounded-[14px] border bg-white p-4"
          style={{ borderColor: 'var(--app-line)' }}
        >
          <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
            PC 레이아웃 보기
          </div>
          <p
            className="mt-1 text-[13.8px] leading-[1.6] text-[var(--app-copy-muted)]"
            style={{ wordBreak: 'keep-all' }}
          >
            모바일은 자동으로 모바일 보기. PC 에서만 사이드바·상단 네비를 고를 수 있습니다.
          </p>
          <div className="mt-3">
            <LayoutModeControl />
          </div>
        </article>
        {/* 카카오 알림톡 수신용 전화번호 + 광고(친구톡) 수신동의 */}
        <KakaoContactCard />
      </section>

      {/* §읽기 경험 — 글자 / 말투 / 톤 */}
      {SETTINGS_BLUEPRINT && SETTINGS_BLUEPRINT.length > 0 ? (
        <section>
          <h2 className="px-1 text-[12.6px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-muted)]">
            읽기 경험
          </h2>
          {/* 글자 크기 — 모바일 · PC 공통 토글. SETTINGS_BLUEPRINT 카드(텍스트
              설명)와 짝을 이루도록 맨 앞에 실제 컨트롤 카드를 둔다. */}
          <article
            className="mt-2 rounded-[14px] border bg-white p-4"
            style={{ borderColor: 'var(--app-line)' }}
          >
            <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-soft)]">
              글자 크기
            </div>
            <p
              className="mt-1 text-[13.8px] leading-[1.6] text-[var(--app-copy-muted)]"
              style={{ wordBreak: 'keep-all' }}
            >
              읽기 어렵다면 큰글씨로 두 단계만 키워보세요. 본문·버튼·줄간격이
              한 번에 넓어집니다.
            </p>
            <div className="mt-3 max-w-xs">
              <ReadingComfortControl />
            </div>
          </article>
          <div className="mt-2 grid gap-2">
            {SETTINGS_BLUEPRINT.map((item) => (
              <article
                key={item.title}
                className="rounded-[14px] border bg-white p-3.5"
                style={{ borderColor: 'var(--app-line)' }}
              >
                <div className="text-[12.1px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
                  {item.title}
                </div>
                <div
                  className="mt-1 text-[15.5px] font-extrabold text-[var(--app-ink)]"
                  style={{ wordBreak: 'keep-all' }}
                >
                  {item.options}
                </div>
                <p
                  className="mt-1.5 text-[13.8px] leading-[1.65] text-[var(--app-copy-muted)]"
                  style={{ wordBreak: 'keep-all' }}
                >
                  {item.reason}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {/* §고객센터 — 자주하는 질문 / 1:1 문의 (08-4 신규 진입점, 페이지는 후속 PR) */}
      <section>
        <h2 className="px-1 text-[12.6px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-copy-muted)]">
          고객센터
        </h2>
        <div className="mt-2 grid gap-2">
          <QuickLink
            icon="📚"
            label="자주하는 질문 (FAQ)"
            desc="결제·구독·결과·환불 자주 묻는 질문"
            href="/support/faq"
            tone="jade"
          />
          <QuickLink
            icon="💬"
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
