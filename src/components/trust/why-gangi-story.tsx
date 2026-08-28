// 2026-08-26 전면 개편 — "왜 여기서 사주를 봐야 하나" 설득 스토리(수정요청 PPT 4p~,
//   선월당 벤치마크의 내용 구조: 공감 → 명분 → 차별점 → 신뢰). 이미지는 사용자 제공
//   연출 컷(/images/gangi/story). ⚠️ 정직성: 실존 인물의 대면 상담을 약속하는 카피 금지 —
//   사실만 말한다(명리학 기준 해석·자격 5종 보유·열람 전 전액 환불).
//   순수 표시 컴포넌트 — 서버/클라이언트 어디서든 렌더 가능(사주 입력 페이지 하단이 1착지).

const STORY_IMG = '/images/gangi/story';

const CHAPTERS: ReadonlyArray<{
  eyebrow: string;
  title: string;
  body: string;
  image: string;
  alt: string;
}> = [
  {
    eyebrow: '혼자 끌어안은 밤',
    title: '요즘, 마음속에 맴도는 질문이 있으신가요',
    body:
      '일이 왜 이렇게 풀리지 않는지, 이 사람과 계속 가도 되는지, 지금 옮기는 게 맞는지. 누구에게 물어보기도 애매한 고민일수록 혼자 오래 끌어안게 됩니다. 그럴 때 필요한 건 막연한 위로가 아니라, 내 흐름을 차분히 읽어주는 기준입니다.',
    image: `${STORY_IMG}/worry.jpg`,
    alt: '늦은 밤 고민에 잠긴 사람',
  },
  {
    eyebrow: '점이 아니라 학문',
    title: '사주는 태어난 순간의 기록을 읽는 명리학입니다',
    body:
      '생년월일시를 여덟 글자(사주팔자)로 옮기고, 고전 명리학의 원칙 — 일주·격국·용신·오행의 균형 — 에 따라 해석합니다. 간지사주는 이 기준을 그대로 따릅니다. 기분에 따라 달라지는 말이 아니라, 같은 사주에는 같은 구조가 나오는 해석입니다.',
    image: `${STORY_IMG}/study.jpg`,
    alt: '고전 명리서를 펼쳐 기록하는 서재',
  },
  {
    eyebrow: '무엇이 다른가',
    title: '용어 나열이 아니라 "앞으로 어떻게"까지',
    body:
      '격국이 무엇이고 용신이 무엇인지 늘어놓는 풀이는 읽고 나도 남는 게 없습니다. 간지사주는 17가지 항목으로 구조를 나눠, 각 항목이 지금의 일·관계·결정에 어떤 의미인지, 오늘부터 무엇을 하면 되는지까지 생활 언어로 풀어드립니다.',
    image: `${STORY_IMG}/consult.jpg`,
    alt: '만세력을 짚으며 풀이를 설명하는 상담 자리',
  },
  {
    eyebrow: '믿고 볼 수 있는 이유',
    title: '전문 자격 5종, 명리학 기준으로 해석합니다',
    body:
      '명리심리상담사 1급 · 사주적성상담사 1급 · 타로심리상담사 1급 · 빅데이터전문가 1급 · 명리심리상담사 2급. 재미용 운세가 아니라 명리학 기준으로 해석하며, 유료 리포트는 열람하기 전이라면 전액 환불을 요청하실 수 있습니다.',
    image: `${STORY_IMG}/creds.jpg`,
    alt: '전문 자격 5종이 적힌 서재',
  },
];

export function WhyGangiStory({ className = '' }: { className?: string }) {
  return (
    <section
      id="why-gangi"
      aria-label="간지사주에서 사주를 봐야 하는 이유"
      className={`scroll-mt-24 space-y-5 ${className}`.trim()}
    >
      <div>
        <div className="text-[12.6px] font-extrabold uppercase tracking-[0.06em] text-[var(--app-pink-strong)]">
          왜 간지사주인가
        </div>
        <h2 className="mt-1 text-[22.5px] font-extrabold leading-snug tracking-tight text-[var(--app-ink)]">
          여기서 사주를 봐야 하는 이유
        </h2>
      </div>

      {CHAPTERS.map((chapter) => (
        <article
          key={chapter.eyebrow}
          className="overflow-hidden rounded-[18px] border border-[var(--app-line)] bg-white"
        >
          <img
            src={chapter.image}
            alt={chapter.alt}
            loading="lazy"
            decoding="async"
            className="block aspect-[16/9] w-full object-cover"
          />
          <div className="p-5">
            <div className="text-[12.6px] font-extrabold uppercase tracking-[0.05em] text-[var(--app-pink-strong)]">
              {chapter.eyebrow}
            </div>
            <h3 className="mt-1 text-[18.4px] font-extrabold leading-snug text-[var(--app-ink)]">
              {chapter.title}
            </h3>
            <p
              className="mt-2 text-[14.7px] leading-[1.7] text-[var(--app-copy-soft)]"
              style={{ wordBreak: 'keep-all' }}
            >
              {chapter.body}
            </p>
          </div>
        </article>
      ))}
    </section>
  );
}
