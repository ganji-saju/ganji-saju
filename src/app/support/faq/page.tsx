// 2026-05-15 — 고객센터 FAQ 페이지 신규.
// 사용자 피드백: "고객센터 자주하는질문, 1:1문의는 신규로 만들어야 할 거 같아."
// 최소 구현: 결제·구독·결과·환불·계정 5개 카테고리 × 자주 묻는 질문 3~4개씩.
// 후속 PR 에서 검색·필터·실시간 업데이트 추가 가능.
import type { Metadata } from 'next';
import Link from 'next/link';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

export const metadata: Metadata = {
  title: '자주하는 질문 (FAQ)',
  description: '간지사주 자주하는 질문 — 결제·구독·풀이·환불·계정 안내.',
  alternates: { canonical: '/support/faq' },
};

interface FaqItem {
  q: string;
  a: string;
}

interface FaqGroup {
  title: string;
  emoji: string;
  items: FaqItem[];
}

const FAQ_GROUPS: FaqGroup[] = [
  {
    title: '결제·코인',
    emoji: '💳',
    items: [
      {
        q: '결제 후 코인이 바로 들어오지 않으면 어떻게 하나요?',
        a: '결제 후 30초 안에 자동 충전됩니다. 새로 고침 후에도 반영되지 않으면 결제 영수증을 들고 1:1 문의로 알려주세요. 토스 결제는 평일 9~18시 사이 영업일 1일 이내에 처리됩니다.',
      },
      {
        q: '코인 1개로 무엇을 살 수 있나요?',
        a: '오늘 자세히 보기는 1코인 (550원). 좋은날 1개월 캘린더는 2코인 (1,900원). 코인은 결제 시점부터 1년간 유효합니다.',
      },
      {
        q: '같은 풀이를 다시 열어도 코인이 또 빠지나요?',
        a: '한 번 연 같은 결과는 다시 코인이 차감되지 않습니다. 사주 결과 페이지에서 자세히 보기를 다시 누를 때 "구매한 풀이 열기" 로 노출되며 결제 없이 바로 열립니다.',
      },
      {
        q: '환불이 가능한가요?',
        a: '결제 후 콘텐츠를 한 번도 열지 않은 경우 7일 이내 환불 가능합니다. 콘텐츠 열람 이후는 디지털 재화 특성상 환불이 어렵습니다. 1:1 문의로 영수증과 함께 요청해 주세요.',
      },
    ],
  },
  {
    title: '구독·멤버십',
    emoji: '💎',
    items: [
      {
        q: '라이트와 프리미엄의 차이가 뭔가요?',
        a: '라이트 (4,900원/월): 매일 해석 10회, 사주풀이 미리보기 월 2회, 대화 상담 월 30턴. 프리미엄 (9,900원/월): 매일 해석 30회, 궁합 월 3회, 가족 5명, 대화 상담 월 120턴. 두 플랜 모두 공정사용정책이 적용됩니다.',
      },
      {
        q: '구독 해지 후 코인은 남아 있나요?',
        a: '구독으로 충전된 코인은 구독 종료 시 함께 만료됩니다. 결제로 구매한 일반 코인은 1년간 유효합니다.',
      },
      {
        q: '평생 리포트가 무엇인가요?',
        a: '49,000원 일회성 결제로 평생 인생 흐름 리포트 (대운 10주기 + 세운 30년 + 십성 디테일 + PDF 보관 + 1:1 30분 풀이) 를 받습니다. 구독과 별개입니다.',
      },
    ],
  },
  {
    title: '풀이·해석',
    emoji: '🔮',
    items: [
      {
        q: '내 이름이 다르게 나와요',
        a: '회원가입 시 입력한 닉네임이 모든 풀이 호명에 사용됩니다. /my/profile 에서 이름을 수정하면 다음 풀이부터 반영됩니다.',
      },
      {
        q: '오늘 점수가 같은 날 두 번 봐도 똑같이 나오나요?',
        a: '네, 같은 날짜는 동일한 점수가 보이도록 시드 고정. 매일 자정 (KST 0시)에 새로운 일진 풀이로 바뀝니다.',
      },
      {
        q: '시간을 모르면 풀이가 부정확한가요?',
        a: '시간이 없어도 사주 4기둥 중 3개는 정확히 계산됩니다. 시주(시간 기둥) 만 미산정 표시되며 큰 흐름 풀이에는 영향이 적습니다. 정밀 풀이 원하시면 시간 입력을 권장합니다.',
      },
      {
        q: '진태양시·야자시 옵션이 뭔가요?',
        a: '한국 표준시 (135°) 와 출생지 경도 차이로 ±30분 오차가 발생합니다. 진태양시는 균시차까지 보정해 정밀도 ±30초로 사주를 계산합니다. 정확성이 중요하다면 켜두세요.',
      },
    ],
  },
  {
    title: '계정·로그인',
    emoji: '👤',
    items: [
      {
        q: '비밀번호를 잊었어요',
        a: '/forgot-password 로 직접 접속하시거나, 로그인 화면 하단의 "비밀번호를 잊으셨나요?" 버튼을 누르면 가입 이메일로 재설정 링크를 받을 수 있습니다.',
      },
      {
        q: '회원탈퇴는 어떻게 하나요?',
        a: '/my/settings/delete-account 에서 진행할 수 있습니다. 탈퇴 시 모든 사주 데이터, 결제 이력, 코인 잔액이 삭제되며 복구 불가능합니다.',
      },
      {
        q: '한 계정에 여러 사주를 저장할 수 있나요?',
        a: '네, 가족·다른 사람 정보로 5명까지 저장 가능합니다 (프리미엄 멤버십 한도). /my/profile 에서 관리할 수 있습니다.',
      },
    ],
  },
  {
    title: '기타',
    emoji: '❓',
    items: [
      {
        q: '풀이 결과가 맘에 안 들어요',
        a: '오늘운세 결과 페이지 하단의 피드백 카드에서 정확도를 알려주실 수 있습니다. 모든 피드백은 익명으로 학습 데이터로 사용되어 풀이 정확도 개선에 쓰입니다.',
      },
      {
        q: '검색 기능은 언제 추가되나요?',
        a: '사주 결과·꿈해몽·고전 등을 통합 검색하는 기능은 출시 예정입니다. 현재는 보관함과 각 서비스 화면에서 확인해 주세요.',
      },
      {
        q: '아래에 없는 질문이 있어요',
        a: '1:1 문의로 보내주세요. 평일 9~18시 사이 답변 드립니다.',
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage space-y-5">
        <GangiPageHeader title="자주하는 질문" backHref="/my/settings" />

        <article
          className="rounded-[18px] border p-5"
          style={{
            background: 'var(--app-pink-soft)',
            borderColor: 'var(--app-pink-line)',
          }}
        >
          <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
            📚 FAQ
          </div>
          <h1
            className="mt-1.5 text-[22px] font-extrabold leading-snug tracking-tight text-[var(--app-ink)]"
            style={{ wordBreak: 'keep-all' }}
          >
            먼저 자주 묻는 질문을
            <br />
            찾아보세요
          </h1>
          <p
            className="mt-2 text-[12.5px] leading-[1.6] text-[var(--app-copy-muted)]"
            style={{ wordBreak: 'keep-all' }}
          >
            결제·구독·풀이·계정 5개 영역 자주 묻는 질문을 정리했습니다. 찾는 답이 없으면 1:1 문의로 바로 보내주세요.
          </p>
        </article>

        {FAQ_GROUPS.map((group) => (
          <section key={group.title}>
            <h2
              className="px-1 text-[14.5px] font-extrabold text-[var(--app-ink)]"
              style={{ wordBreak: 'keep-all' }}
            >
              {group.emoji} {group.title}
            </h2>
            <div className="mt-2 grid gap-2">
              {group.items.map((item, idx) => (
                <details
                  key={`${group.title}-${idx}`}
                  className="group rounded-[14px] border bg-white"
                  style={{ borderColor: 'var(--app-line)' }}
                >
                  <summary
                    className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3.5"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="mr-1.5 font-extrabold text-[var(--app-pink-strong)]">
                        Q{idx + 1}.
                      </span>
                      <span
                        className="text-[13.5px] font-extrabold text-[var(--app-ink)]"
                        style={{ wordBreak: 'keep-all' }}
                      >
                        {item.q}
                      </span>
                    </div>
                    <span
                      className="shrink-0 text-[12px] text-[var(--app-copy-soft)] transition-transform group-open:rotate-180"
                      aria-hidden="true"
                    >
                      ▾
                    </span>
                  </summary>
                  <div
                    className="border-t border-[var(--app-line)] px-4 py-3 text-[12.5px] leading-[1.7] text-[var(--app-copy)]"
                    style={{ wordBreak: 'keep-all' }}
                  >
                    {item.a}
                  </div>
                </details>
              ))}
            </div>
          </section>
        ))}

        <article
          className="rounded-[18px] p-5 text-white"
          style={{
            background: 'var(--app-ink)',
            boxShadow: '0 18px 44px rgba(15,23,42,0.18)',
          }}
        >
          <div
            className="text-[11px] font-extrabold uppercase tracking-[0.04em]"
            style={{ color: 'var(--app-pink)' }}
          >
            못 찾으셨다면
          </div>
          <h2 className="mt-1.5 text-[17px] font-extrabold leading-snug tracking-tight">
            1:1 문의로 직접 보내주세요
          </h2>
          <p
            className="mt-2 text-[12.5px] leading-[1.6]"
            style={{ opacity: 0.72 }}
          >
            평일 9~18시 사이 답변 드립니다. 결제 영수증·캡처가 있다면 함께 첨부해 주세요.
          </p>
          <Link
            href="/support/contact"
            className="mt-4 inline-flex items-center justify-center rounded-full bg-[var(--app-pink)] px-5 py-3 text-[13.5px] font-extrabold text-white shadow-[0_12px_28px_rgba(216,27,114,0.32)]"
          >
            1:1 문의 보내기 →
          </Link>
        </article>
      </AppPage>
    </AppShell>
  );
}
