// 2026-05-14: 13개 모션 보드용 React primitive 모음.
// - prefers-reduced-motion 자동 차단 (모든 primitive 가 useReducedMotion 훅 적용).
// - Framer Motion 의존성 없이 순수 CSS keyframes + React state 만 사용.
// - SSR 안전 (window 접근 useEffect 안에서만).
// - 각 primitive 는 `m-{id}` 로 anchor 할 수 있게 id 를 받음.
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * prefers-reduced-motion 감지 훅. SSR 안전.
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

// ============================================================================
// 51 · m-loading — 사주 분석 로딩 (6s 루프, 月 한자 + 팔자 슬롯 등장)
// 2026-05-15: production 연결을 위해 labels 와 moonGlyph 를 prop 으로 교체.
// caller (결제 success / 풀이 intake / today-detail) 가 자기 컨텍스트의 라벨 주입.
// ============================================================================
const DEFAULT_SAJU_LOADING_LABELS = [
  '년주 정리',
  '월주 정리',
  '일주 정리',
  '시주 정리',
  '오행 균형',
  '도움 기운',
];

export function MotionSajuLoading({
  active = true,
  labels = DEFAULT_SAJU_LOADING_LABELS,
  moonGlyph = '月',
}: {
  active?: boolean;
  labels?: string[];
  moonGlyph?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <div className="motion-saju-loading" data-active={active}>
      <span className="motion-saju-moon" aria-hidden="true">{moonGlyph}</span>
      <ul className="motion-saju-steps">
        {labels.map((label, index) => (
          <li
            key={`${label}-${index}`}
            style={{ animationDelay: reduced ? '0s' : `${index * 0.8}s` }}
            className={reduced ? 'motion-saju-step is-static' : 'motion-saju-step'}
          >
            <span className="motion-saju-step-dot" />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================================
// 52 · m-reveal — 결과 카드 stagger 등장
// 2026-05-15: production 연결을 위해 children prop 추가. children 이 있으면 각 자식을
// 0.15s 간격으로 stagger reveal, 없으면 gallery 용 데모 카드 4개를 보여준다.
// ============================================================================
import { Children, isValidElement, cloneElement } from 'react';
import type { ReactNode, ReactElement } from 'react';

export function MotionResultReveal({
  active = true,
  children,
  staggerSeconds = 0.15,
}: {
  active?: boolean;
  /** production 사용 시 카드/섹션 children. 비어 있으면 gallery 데모. */
  children?: ReactNode;
  staggerSeconds?: number;
}) {
  const reduced = useReducedMotion();

  if (children !== undefined) {
    // 2026-05-15 PR-C: children 모드는 caller 의 기존 layout 을 유지해야 하므로
    // grid/gap 을 두는 gallery 모드 클래스 대신 layout-neutral wrapper 클래스 사용.
    return (
      <div
        className="motion-result-reveal motion-result-reveal-children"
        data-active={active && !reduced}
      >
        {Children.map(children, (child, index) => {
          const delay = reduced ? '0s' : `${index * staggerSeconds}s`;
          if (!isValidElement(child)) {
            return (
              <div key={index} className="motion-reveal-slot" style={{ animationDelay: delay }}>
                {child}
              </div>
            );
          }
          const element = child as ReactElement<{ style?: React.CSSProperties; className?: string; key?: React.Key }>;
          return (
            <div
              key={element.key ?? index}
              className="motion-reveal-slot"
              style={{ animationDelay: delay }}
            >
              {cloneElement(element)}
            </div>
          );
        })}
      </div>
    );
  }

  // Gallery fallback — 기존 데모.
  return (
    <div className="motion-result-reveal" data-active={active && !reduced}>
      <div className="motion-card motion-card-hero">총평 95점</div>
      <div className="motion-card" style={{ animationDelay: reduced ? '0s' : '0.15s' }}>
        오행 분포
      </div>
      <div className="motion-card" style={{ animationDelay: reduced ? '0s' : '0.30s' }}>
        오늘 한 줄
      </div>
      <div className="motion-card" style={{ animationDelay: reduced ? '0s' : '0.45s' }}>
        다음 흐름
      </div>
    </div>
  );
}

// ============================================================================
// 53 · m-tarot — 타로 카드 3D flip
// ============================================================================
export function MotionTarotFlip({ active = true }: { active?: boolean }) {
  const reduced = useReducedMotion();
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    if (!active) return setFlipped(false);
    if (reduced) return setFlipped(true);
    const timer = setTimeout(() => setFlipped(true), 800);
    return () => clearTimeout(timer);
  }, [active, reduced]);
  return (
    <button
      type="button"
      onClick={() => setFlipped((v) => !v)}
      className="motion-tarot-flip"
      data-flipped={flipped}
      aria-label="타로 카드 뒤집기"
    >
      <span className="motion-tarot-card motion-tarot-back" aria-hidden="true">月</span>
      <span className="motion-tarot-card motion-tarot-front" aria-hidden="true">VII · The Chariot</span>
    </button>
  );
}

// ============================================================================
// 54 · m-coin — 코인 충전 성공 (입자 + 카드 확정)
// 2026-05-15: production 연결을 위해 title / sub prop 추가. 결제·코인·멤버십 등
// success 화면에서 자기 컨텍스트의 라벨 주입 (예: "+ 7 코인", "Plus 멤버십 시작").
// ============================================================================
export function MotionCoinSuccess({
  active = true,
  title = '충전 완료',
  sub = '+ 7 코인',
}: {
  active?: boolean;
  title?: string;
  sub?: string;
}) {
  const reduced = useReducedMotion();
  const particles = useMemo(() => Array.from({ length: 12 }, (_, i) => i), []);

  return (
    <div className="motion-coin-success" data-active={active && !reduced}>
      <div className="motion-coin-card">
        <div className="motion-coin-check" aria-hidden="true">✓</div>
        <div className="motion-coin-title">{title}</div>
        <div className="motion-coin-sub">{sub}</div>
      </div>
      {!reduced
        ? particles.map((i) => (
            <span
              key={i}
              className="motion-coin-particle"
              style={{
                left: `${50 + Math.cos((i / 12) * Math.PI * 2) * 30}%`,
                top: `${50 + Math.sin((i / 12) * Math.PI * 2) * 30}%`,
                animationDelay: `${(i / 12) * 0.4}s`,
              }}
              aria-hidden="true"
            />
          ))
        : null}
    </div>
  );
}

// ============================================================================
// 55 · m-page — 페이지 전환 (slide + crossfade)
// ============================================================================
export function MotionPageTransition({ active = true }: { active?: boolean }) {
  const reduced = useReducedMotion();
  const [step, setStep] = useState<0 | 1>(0);
  useEffect(() => {
    if (!active) return;
    if (reduced) return setStep(1);
    const timer = setInterval(() => setStep((s) => (s === 0 ? 1 : 0)), 2500);
    return () => clearInterval(timer);
  }, [active, reduced]);
  return (
    <div className="motion-page-transition" data-step={step} data-reduced={reduced}>
      <div className="motion-page motion-page-prev">홈 화면</div>
      <div className="motion-page motion-page-next">사주 결과</div>
    </div>
  );
}

// ============================================================================
// 56 · m-modal — 모달 등장 (dim + sheet)
// ============================================================================
export function MotionModalAppear({ active = true }: { active?: boolean }) {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!active) return setOpen(false);
    const timer = setTimeout(() => setOpen(true), 400);
    return () => clearTimeout(timer);
  }, [active]);
  return (
    <div className="motion-modal-stage" data-open={open} data-reduced={reduced}>
      <div className="motion-modal-page">페이지 본문</div>
      {open ? (
        <>
          <div className="motion-modal-dim" />
          <div className="motion-modal-sheet">
            <div className="motion-modal-handle" />
            <div className="motion-modal-title">소액 풀이 안내</div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="motion-modal-close"
            >
              닫기
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

// ============================================================================
// 57 · m-toast — 토스트 큐 (stack 등장/퇴장)
// ============================================================================
export function MotionToastStack({ active = true }: { active?: boolean }) {
  const reduced = useReducedMotion();
  const [items, setItems] = useState<string[]>([]);
  const queue = ['저장됨', '복사됨', '코인 적립됨'];
  useEffect(() => {
    if (!active) return setItems([]);
    if (reduced) return setItems(queue);
    let i = 0;
    const interval = setInterval(() => {
      setItems((prev) => {
        const next = [...prev, queue[i % queue.length]].slice(-3);
        i += 1;
        return next;
      });
    }, 1500);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reduced]);
  return (
    <div className="motion-toast-stack" data-reduced={reduced}>
      {items.map((text, index) => (
        <div key={`${text}-${index}`} className="motion-toast" data-index={index}>
          ✓ {text}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// 58 · m-push — 푸시 알림 도착 (slide down from top)
// ============================================================================
export function MotionPushArrive({ active = true }: { active?: boolean }) {
  const reduced = useReducedMotion();
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    if (!active) return setArrived(false);
    const timer = setTimeout(() => setArrived(true), 600);
    return () => clearTimeout(timer);
  }, [active]);
  return (
    <div className="motion-push-stage" data-arrived={arrived} data-reduced={reduced}>
      <div className="motion-push-statusbar">9:41 · 달빛인생</div>
      {arrived ? (
        <div className="motion-push-card">
          <div className="motion-push-icon" aria-hidden="true">月</div>
          <div className="motion-push-body">
            <strong>오늘 운세가 도착했어요</strong>
            <span>가벼운 일부터 시작하면 좋은 흐름</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ============================================================================
// 59 · m-hanja — 한자 변환 (morph + crossfade)
// ============================================================================
export function MotionHanjaMorph({ active = true }: { active?: boolean }) {
  const reduced = useReducedMotion();
  const characters = ['壬', '癸', '甲', '乙'];
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (reduced) return;
    const interval = setInterval(() => setIndex((i) => (i + 1) % characters.length), 1500);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reduced]);
  return (
    <div className="motion-hanja-morph" aria-hidden="true">
      <span key={characters[index]} className="motion-hanja-glyph">
        {characters[index]}
      </span>
    </div>
  );
}

// ============================================================================
// 60 · m-spinners — 6종 스피너
// ============================================================================
export function MotionSpinners({ active = true }: { active?: boolean }) {
  const reduced = useReducedMotion();
  const variants: Array<'ring' | 'dots' | 'bar' | 'pulse' | 'orbit' | 'pinwheel'> = [
    'ring',
    'dots',
    'bar',
    'pulse',
    'orbit',
    'pinwheel',
  ];
  return (
    <div className="motion-spinners-grid" data-reduced={reduced} data-active={active}>
      {variants.map((variant) => (
        <div key={variant} className={`motion-spinner motion-spinner-${variant}`}>
          {variant === 'dots' ? (
            <>
              <span /><span /><span />
            </>
          ) : variant === 'pinwheel' ? (
            <>
              <span /><span /><span /><span />
            </>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// 61 · m-input — 인풋 포커스 + validation
// ============================================================================
export function MotionInputFocus({ active = true }: { active?: boolean }) {
  const reduced = useReducedMotion();
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);
  const strength = value.length === 0 ? 0 : value.length < 4 ? 1 : value.length < 8 ? 2 : 3;
  const valid = value.length >= 4;
  useEffect(() => {
    if (!active) {
      setValue('');
      setTouched(false);
      return;
    }
    if (reduced) {
      setValue('hello123');
      setTouched(true);
      return;
    }
    const sequence = ['', 'h', 'he', 'hel', 'hell', 'hello', 'hello1', 'hello12', 'hello123'];
    let i = 0;
    const interval = setInterval(() => {
      setValue(sequence[i % sequence.length] ?? '');
      setTouched(true);
      i += 1;
    }, 600);
    return () => clearInterval(interval);
  }, [active, reduced]);
  return (
    <div className="motion-input-focus" data-reduced={reduced}>
      <label className="motion-input-label">비밀번호</label>
      <input
        className="motion-input-field"
        value={value}
        readOnly
        data-valid={valid}
        data-touched={touched}
      />
      <div className="motion-input-strength" data-level={strength} />
      <div className="motion-input-feedback" data-valid={valid}>
        {valid ? '✓ 사용 가능' : '4자 이상 입력해주세요'}
      </div>
    </div>
  );
}

// ============================================================================
// 62 · m-chart — 차트 그리기 (bar/ring/path draw-in)
// ============================================================================
export function MotionChartDraw({ active = true }: { active?: boolean }) {
  const reduced = useReducedMotion();
  const bars = [
    { label: '목', value: 30, color: 'var(--app-jade)' },
    { label: '화', value: 80, color: 'var(--app-coral)' },
    { label: '토', value: 50, color: 'var(--app-amber)' },
    { label: '금', value: 70, color: 'var(--app-copy-soft, #94a3b8)' },
    { label: '수', value: 65, color: 'var(--app-sky)' },
  ];
  return (
    <div className="motion-chart-draw" data-reduced={reduced} data-active={active}>
      {bars.map((bar, index) => (
        <div key={bar.label} className="motion-chart-row">
          <span className="motion-chart-label">{bar.label}</span>
          <span
            className="motion-chart-bar"
            style={{
              width: `${bar.value}%`,
              background: bar.color,
              animationDelay: reduced ? '0s' : `${index * 0.18}s`,
            }}
          />
          <span className="motion-chart-value">{bar.value}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// 63 · m-palshja — 사주팔자 셔플 (8글자 슬롯)
// ============================================================================
export function MotionPalshjaShuffle({ active = true }: { active?: boolean }) {
  const reduced = useReducedMotion();
  const finalChars = ['壬', '子', '甲', '辰', '辛', '丑', '辛', '酉'];
  const pool = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸', '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const [chars, setChars] = useState<string[]>(reduced ? finalChars : pool.slice(0, 8));
  const settledRef = useRef(false);

  useEffect(() => {
    if (!active) {
      setChars(pool.slice(0, 8));
      settledRef.current = false;
      return;
    }
    if (reduced) {
      setChars(finalChars);
      settledRef.current = true;
      return;
    }
    settledRef.current = false;
    let ticks = 0;
    const interval = setInterval(() => {
      ticks += 1;
      if (ticks >= 18) {
        clearInterval(interval);
        setChars(finalChars);
        settledRef.current = true;
        return;
      }
      setChars(
        Array.from({ length: 8 }, () => pool[Math.floor(Math.random() * pool.length)])
      );
    }, 200);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reduced]);

  return (
    <div className="motion-palshja" aria-hidden="true">
      {chars.map((c, i) => (
        <span key={i} className="motion-palshja-slot" data-settled={settledRef.current}>
          {c}
        </span>
      ))}
    </div>
  );
}
