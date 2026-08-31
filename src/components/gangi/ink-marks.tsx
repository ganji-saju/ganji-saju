// 2026-09-01 — 작은 자리(12~22px)의 이모지를 대체하는 **먹선 마크**.
//   왜 그림이 아니라 SVG 인가: 민화 그림은 40px 아래에서 뭉개지고 크림 배경 사각형이 따라붙어
//   오히려 이모지보다 지저분해진다. 이 크기대는 1~2획 먹선이 정답이다 —
//   어느 배율에서도 또렷하고, currentColor 라 섹션 색(옥·산호·먹)을 그대로 따라간다.
//   ⚠️여기에 글자를 넣지 않는다(그림에 글자 맡기지 않는 원칙과 동일).

interface InkMarkProps {
  /** 렌더 크기(px). 기본 16 — 12.1px 라벨 옆에 붙는 기준. */
  size?: number;
  className?: string;
}

function Svg({
  size = 16,
  className = '',
  children,
}: InkMarkProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`inline-block shrink-0 align-[-0.15em] ${className}`}
    >
      {children}
    </svg>
  );
}

/** 잘 맞는 점 — 매듭(합). 두 줄이 하나로 엮이는 형태. */
export function InkKnotMark(props: InkMarkProps) {
  return (
    <Svg {...props}>
      <path d="M7 5c0 4.2 10 4.2 10 8.4S9.5 20 7 16.5" />
      <path d="M17 5c0 4.2-10 4.2-10 8.4" opacity={0.55} />
    </Svg>
  );
}

/** 부딪칠 수 있는 점 — 갈라지는 획(균열). */
export function InkFractureMark(props: InkMarkProps) {
  return (
    <Svg {...props}>
      <path d="M13.5 3 8 12.5h5L9.5 21" />
      <path d="M18 7.5 20.5 10" opacity={0.5} />
      <path d="M4 14l2.5 2.5" opacity={0.5} />
    </Svg>
  );
}

/** 함께하면 좋은 시간 — 초승달과 별. */
export function InkMoonMark(props: InkMarkProps) {
  return (
    <Svg {...props}>
      <path d="M16.5 3.6a8.4 8.4 0 1 0 4 11.2A9 9 0 0 1 16.5 3.6Z" />
      <path d="M6.5 5.2v2.6M5.2 6.5h2.6" opacity={0.65} />
    </Svg>
  );
}

/** 갈등이 생기면 — 방패(지킴). */
export function InkShieldMark(props: InkMarkProps) {
  return (
    <Svg {...props}>
      <path d="M12 3 5 5.8v5.4c0 4.3 3 7.7 7 9.8 4-2.1 7-5.5 7-9.8V5.8Z" />
      <path d="M9.4 12.1 11.3 14l3.6-3.7" opacity={0.7} />
    </Svg>
  );
}

/** 진행 안내 — 등불. */
export function InkLanternMark(props: InkMarkProps) {
  return (
    <Svg {...props}>
      <path d="M12 3v1.6M8.4 7.2h7.2v6.2a3.6 3.6 0 0 1-7.2 0Z" />
      <path d="M9.8 20h4.4M12 17v3" opacity={0.7} />
    </Svg>
  );
}

/** 입력 요약 — 붓. */
export function InkBrushMark(props: InkMarkProps) {
  return (
    <Svg {...props}>
      <path d="M19.4 4.6 9.8 14.2l-1.4 3.4 3.4-1.4 9.6-9.6Z" />
      <path d="M4 20c2.4.4 4-.7 4.4-2.4" opacity={0.7} />
    </Svg>
  );
}

/** 다른 조합 보기 — 순환(두 화살표가 원을 이룬다). */
export function InkCycleMark(props: InkMarkProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 12a7.5 7.5 0 0 1 12.8-5.3M19.5 12a7.5 7.5 0 0 1-12.8 5.3" />
      <path d="M17.3 3.2v3.5h-3.5M6.7 20.8v-3.5h3.5" opacity={0.75} />
    </Svg>
  );
}
