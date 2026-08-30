// 12간지 로딩 화면.
//
// 2026-05-16 PR #154 최초판은 보라 그라데이션 카드 + 별입자 배경이었다. 2026-08-25 전면
// 개편으로 사이트가 한지(#FBF7EE)+인주(#B3372A) 톤이 되면서 **로딩만 옛 브랜드로 남아**
// 페이지가 뜨는 순간 색이 튀었다(사용자 제보: "로딩화면 디자인이 구버전이라").
//
// 2026-08-29 — 한지 톤으로 재설계. 가운데엔 수호신 클립 12종을 2.6초마다 한 마리씩 돌렸다.
// 2026-08-30 #710 — 12지신이 **한 원반에 함께** 선 힉스필드 모션 1개로 교체했다.
// 2026-08-30 #711 — 그 원반이 **답답하다**는 제보(전신 12개가 264px 안에 꽉 찼다. 얼굴이
//   12px 라 누가 누군지 안 보이고 여백도 없었다). 전신을 버리고 **얼굴만 잘라 고리로**
//   돌린다. 얼굴이 약 4배 커졌다(12px → 48px).
//
//   · 회전은 **CSS 가 한다.** 모델에게 돌리라고 하면 12캐릭터가 서로 morph 한다(#710 에서
//     "카메라 완전 고정" 을 건 이유). CSS 회전은 무한 선형이라 이음매도 없다.
//   · 그래서 영상이 필요 없다 — webp 12장 92KB 로 끝난다(원반 영상은 140KB 였다).
//   · 고리가 돌면 얼굴도 같이 기울므로 **안쪽에서 같은 주기로 되돌린다**(항상 똑바로 선다).
//   · 고리 안쪽이 비어 "아무것도 안 나오는 것처럼" 보인다는 제보(#712) — 12지 한자가
//     **자기 지지 방향에서 날아와 도장처럼 박히게** 했다. 고리는 그림, 가운데는 글자다.
//   · 얼굴 크롭은 캐릭터마다 다르다 — 용 뿔·토끼 귀·닭 볏이 잘려서 폭과 시작 y 를 따로
//     잡았다. 다시 만들 땐 `tools` 가 아니라 PROGRESS 2026-08-30 항목의 표를 봐라.
//
// 유지해야 하는 것:
//   · props(title/description/steps) — 호출자 2곳이 그대로 쓴다.
//   · createPortal(document.body) — 조상 transform(app-fade-up)이 position:fixed 의
//     containing block 을 만들어 오버레이가 엉뚱한 자리에 뜨던 회귀(2026-05-16).
'use client';

import { useMemo, useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import './zodiac-wheel-loading.css';

/** 12지: 지지 한자 · 얼굴 에셋 id · 우리말 이름. 순서가 곧 고리 배치 순서다. */
const BRANCHES = [
  { char: '子', id: 'rat', name: '쥐' },
  { char: '丑', id: 'ox', name: '소' },
  { char: '寅', id: 'tiger', name: '호랑이' },
  { char: '卯', id: 'rabbit', name: '토끼' },
  { char: '辰', id: 'dragon', name: '용' },
  { char: '巳', id: 'snake', name: '뱀' },
  { char: '午', id: 'horse', name: '말' },
  { char: '未', id: 'sheep', name: '양' },
  { char: '申', id: 'monkey', name: '원숭이' },
  { char: '酉', id: 'rooster', name: '닭' },
  { char: '戌', id: 'dog', name: '개' },
  { char: '亥', id: 'pig', name: '돼지' },
] as const;

const FACE_BASE = '/images/gangi/guardians/faces';
/** 고리 반지름 — 무대 크기 대비 %. px 로 박으면 좁은 폰(320px)에서 카드 밖으로 넘친다.
 *  얼굴이 무대의 18% 이므로 38 + 9 = 47% < 50% — 무대 안에 딱 들어온다. */
const RADIUS_PCT = 38;
/** 한자 하나가 날아와 박히고 사라지기까지. 12개가 이 간격으로 이어져 한 바퀴를 돈다. */
const STAMP_MS = 1150;

/** 하단 바를 채우는 규칙. 자세한 근거는 elapsedProgress 주석 참고. */
const BAR_CEILING = 0.94;
/** 경과 표시가 나타나기까지. 1초 만에 끝나는 화면에서 "0초 경과" 가 깜빡이면 소음이다.
 *  느린 화면(PDF)에서만 자연스럽게 등장하고, 빠른 화면에선 아무도 못 본다. */
const REVEAL_AFTER_MS = 2200;

const DEFAULT_STEPS = [
  '네 기둥(年月日時) 세우는 중',
  '오행 균형 재는 중',
  '오늘 일진과 맞춰보는 중',
  '풀이 문장 다듬는 중',
];

interface Props {
  title?: string;
  description?: string;
  /** 진행 단계. 4개로 정규화된다(애니메이션 delay 가 4개 고정). */
  steps?: string[];
  /**
   * 이 화면이 **보통** 걸리는 시간(ms). 주면 하단에 "N초 경과 · 보통 …쯤" 을 띄운다.
   *
   * 2026-08-30 #715 제보: "로딩이 너무 길어서 풀이가 안 나오는 건가 오류가 난 건가
   * 오해하기 쉽다." 진짜 진행률은 못 만든다 — PDF 는 서버 컴포넌트가 LLM 생성을 통째로
   * await 하고, 그동안 서버→클라이언트로 진행을 알릴 통로가 없다(챕터 캐시도 한 요청
   * 안에서는 마지막 것만 남아 밖에서 셀 수 없다).
   * 🔴 그래서 **가짜 %를 쓰지 않는다.** 99% 에 멈춰 있으면 지금보다 더 고장 같아 보인다.
   * 진실을 말하는 건 **경과 초**이고, 바는 "살아 있다"는 신호일 뿐이다.
   */
  estimateMs?: number;
}

/**
 * 경과 시간 → 바 채움(0~BAR_CEILING).
 *
 * 지수 감쇠라 **항상 움직이지만 끝에 닿지 않는다.** 이게 핵심이다:
 *   · 예상이 짧게 잡혔어도 바가 100% 에서 멈춰 "끝났는데 안 넘어간다" 로 안 보인다.
 *   · 예상이 길게 잡혔어도 초반에 눈에 띄게 움직여 "멈췄다" 로 안 보인다.
 * 즉 **예상치가 틀려도 화면이 거짓말을 하지 않는다.** 정확한 값은 옆의 경과 초가 든다.
 */
export function elapsedProgress(elapsedMs: number, estimateMs: number): number {
  if (estimateMs <= 0) return 0;
  return BAR_CEILING * (1 - Math.exp(-elapsedMs / estimateMs));
}

/** "1분쯤" · "40초쯤" — 예상 시간을 사람 말로. */
function estimateLabel(ms: number): string {
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}초`;
  const min = Math.round(sec / 30) / 2; // 0.5분 단위
  return Number.isInteger(min) ? `${min}분` : `${Math.floor(min)}분 30초`;
}

export function ZodiacWheelLoading({
  title = '사주를 풀어드리고 있어요',
  description = '네 기둥(年月日時)을 세우고 오늘 흐름과 맞춰보는 중입니다.',
  steps,
  estimateMs,
}: Props) {
  const normalizedSteps = useMemo(() => {
    const list = steps && steps.length > 0 ? steps : DEFAULT_STEPS;
    if (list.length >= 4) return list.slice(0, 4);
    const filled = [...list];
    while (filled.length < 4) filled.push(list[filled.length % list.length]!);
    return filled;
  }, [steps]);

  // SSR 엔 document 가 없다. portal 은 mount 후에만.
  const [mounted, setMounted] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    setMounted(true);
    if (!estimateMs) return;
    const startedAt = Date.now();
    // 500ms 틱 + CSS transition 으로 바는 부드럽게, 초 표시는 1초 단위로 또렷하게.
    const timer = window.setInterval(() => setElapsedMs(Date.now() - startedAt), 500);
    return () => window.clearInterval(timer);
  }, [estimateMs]);

  const ring = useMemo(
    () =>
      BRANCHES.map((branch, i) => {
        const rad = ((-90 + i * 30) * Math.PI) / 180;
        return {
          ...branch,
          // left/top 의 % 는 부모(무대) 기준이라 무대가 줄면 고리도 같이 준다.
          x: Math.cos(rad) * RADIUS_PCT,
          y: Math.sin(rad) * RADIUS_PCT,
          // 한자가 날아오는 시작점 — **자기 지지 방향**에서 온다. em 이라 카드가 줄어도
          // 비율이 유지된다(% 로 쓰면 글자 자신의 크기 기준이라 엉뚱한 곳에서 온다).
          fx: `${(Math.cos(rad) * 3.1).toFixed(2)}em`,
          fy: `${(Math.sin(rad) * 3.1).toFixed(2)}em`,
        };
      }),
    []
  );

  if (!mounted) return null;

  const overlay = (
    <div className="zodiac-loading" role="status" aria-live="polite">
      <div className="zodiac-loading-card">
        <p className="zodiac-loading-eyebrow">십이지 &middot; 十二支</p>

        <div className="zodiac-loading-stage">
          <div className="zodiac-loading-ring" aria-hidden="true">
            {ring.map((branch) => (
              <span
                key={branch.id}
                className="zodiac-loading-face"
                style={{
                  left: `calc(50% + ${branch.x.toFixed(3)}%)`,
                  top: `calc(50% + ${branch.y.toFixed(3)}%)`,
                }}
              >
                {/* 고리가 돌면 얼굴이 같이 기운다 — 같은 주기로 되돌려 항상 똑바로 세운다. */}
                <img
                  className="zodiac-loading-face-img"
                  src={`${FACE_BASE}/${branch.id}.webp`}
                  alt=""
                  width={144}
                  height={144}
                  decoding="async"
                />
              </span>
            ))}
          </div>
          {/* 고리 한가운데 — 12지 한자가 자기 방향에서 날아와 인주처럼 박힌다.
              고리는 그림, 가운데는 글자. 한자는 DOM 이라 렌더가 항상 정확하다. */}
          <span className="zodiac-loading-hub" aria-hidden="true">
            {ring.map((branch, i) => (
              <span
                key={branch.char}
                className="zodiac-loading-stamp"
                style={
                  {
                    '--fx': branch.fx,
                    '--fy': branch.fy,
                    animationDelay: `${i * STAMP_MS}ms`,
                    animationDuration: `${BRANCHES.length * STAMP_MS}ms`,
                  } as CSSProperties
                }
              >
                {branch.char}
              </span>
            ))}
          </span>
        </div>

        <div className="zodiac-loading-copy">
          <p className="zodiac-loading-title">{title}</p>
          <p className="zodiac-loading-desc">{description}</p>
        </div>

        <div className="zodiac-loading-steps">
          {normalizedSteps.map((step, idx) => (
            <span key={idx} className="zodiac-loading-step">
              {step}
            </span>
          ))}
        </div>

        {estimateMs && elapsedMs >= REVEAL_AFTER_MS ? (
          <div className="zodiac-loading-progress">
            <div className="zodiac-loading-bar" aria-hidden="true">
              <span
                className="zodiac-loading-bar-fill"
                style={{ width: `${(elapsedProgress(elapsedMs, estimateMs) * 100).toFixed(1)}%` }}
              />
            </div>
            <p className="zodiac-loading-elapsed">
              {/* ⚠️ 오버레이 전체가 aria-live="polite" 다. 0.5초마다 바뀌는 숫자를 그대로 두면
                  스크린리더가 "2초 경과…3초 경과…" 를 끝없이 읽는다 — 안심시키러 만든 화면이
                  가장 시끄러워진다. 숫자는 숨기고, **한 번만 바뀌는 안내 문구**만 읽힌다. */}
              <span aria-hidden="true">{Math.floor(elapsedMs / 1000)}초 경과 &middot; </span>
              {elapsedMs > estimateMs * 1.6
                ? '생각보다 오래 걸리고 있어요. 그대로 두시면 이어서 나와요'
                : `보통 ${estimateLabel(estimateMs)}쯤 걸려요`}
            </p>
          </div>
        ) : (
          <div className="zodiac-loading-bar" aria-hidden="true">
            <span />
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
