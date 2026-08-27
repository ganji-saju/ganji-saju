'use client';
// 2026-08-28 — 12지신 수호신 카드 초상. 정지 이미지가 진실이고, 영상은 **얹는 것**이다.
//
//   ⚠️ 포스터는 원본 guardians/{id}.jpg 가 아니라 **영상의 첫 프레임**(motion/{id}.webp)이다.
//      영상은 원본을 다시 렌더한 결과라 프레이밍이 미세하게 다르다. 원본을 포스터로 쓰면
//      재생이 시작되는 순간 그림이 한 번 튄다.
//
//   받지 않는 조건(영상에 src 를 아예 붙이지 않아 네트워크 요청이 0이다):
//     · prefers-reduced-motion: reduce  — 접근성. 움직임에 불편한 사용자가 있다.
//     · navigator.connection.saveData   — 데이터 절약 모드.
//   화면 밖이면 재생하지 않는다(IntersectionObserver) — 12장이 동시에 디코딩되면
//   저사양 기기에서 스크롤이 끊긴다.
//
//   iOS 저전력 모드는 autoplay 를 막는다. play() 가 거부되면 포스터가 그대로 남는 게
//   정상 동작이라 따로 처리하지 않는다(에러를 삼키되 화면은 깨지지 않는다).
//
//   ⚠️ video 는 **SSR 부터 항상** 그린다. 처음엔 조건 판정 전이라 img 를 그리고 하이드레이션에서
//      video 로 바꿨는데, 배포본 HTML 을 실측하니 video 태그가 0개였다 — 즉 모든 방문자가
//      picture→video DOM 교체를 겪었다(깜빡임 + 불필요한 재레이아웃). 포스터는 video 의
//      poster 속성만으로도 JS 없이 그려지므로, 요소는 고정하고 **src 만** 조건부로 붙인다.
import { useEffect, useRef, useState } from 'react';

const MOTION_BASE = '/images/gangi/guardians/motion';

/**
 * 🔴 2026-08-28 — 고유 비율을 **속성으로 못박는다**. video 는 소스가 붙기 전
 * 기본 고유크기가 300×150(2:1)이라, 배너처럼 `h-full w-auto` 로 놓인 자리에서
 * 폭이 2:1 로 계산돼 초상이 박스 밖으로 삐져나왔다(대화상담 뱀 배너에서 잡았다).
 * 모션 자산은 전부 3:4(400×534 · t7 560×746)라 300×400 으로 고정한다.
 */
const RATIO_W = 300;
const RATIO_H = 400;

/**
 * idle 루프를 가진 캐릭터. **자산이 있는 것만** 적는다 —
 * 없는 id 로 video 를 그리면 poster 404 라 초상이 통째로 비어 보인다(t7 히어로에서 잡았다).
 * 새 캐릭터를 애니메이션하면 자산과 이 목록을 같이 추가한다.
 */
const MOTION_IDS = new Set([
  'rat', 'ox', 'tiger', 'rabbit', 'dragon', 'snake',
  'horse', 'sheep', 'monkey', 'rooster', 'dog', 'pig',
  't7', // 히어로 배너(손 내미는 환영 포즈) — 배너용이라 560px 로 인코딩했다.
]);

export function GuardianPortrait({
  id,
  alt,
  className,
  style,
  decorative = false,
}: {
  /** guardians/{id}.jpg 의 id — 12지신 키. */
  id: string;
  /** decorative 면 무시된다. */
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  /** 배너 우측 초상처럼 **장식**인 경우 — 스크린리더에서 감춘다(제목이 이미 내용을 말한다). */
  decorative?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [allowMotion, setAllowMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const saveData =
      (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData ??
      false;
    setAllowMotion(!reduce && !saveData);
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !allowMotion) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // src 는 여기서 처음 붙는다 — 화면에 들어오기 전엔 한 바이트도 받지 않는다.
          if (!el.getAttribute('src')) el.setAttribute('src', `${MOTION_BASE}/${id}.mp4`);
          void el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { rootMargin: '120px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [allowMotion, id]);

  // 모션 자산이 없는 캐릭터는 지금까지처럼 정지컷으로 그린다.
  if (!MOTION_IDS.has(id)) {
    return (
      <img
        src={`/images/gangi/guardians/${id}.jpg`}
        alt={decorative ? '' : (alt ?? '')}
        aria-hidden={decorative || undefined}
        width={RATIO_W}
        height={RATIO_H}
        loading="lazy"
        decoding="async"
        className={className}
        style={style}
      />
    );
  }

  return (
    <video
      ref={videoRef}
      poster={`${MOTION_BASE}/${id}.webp`}
      width={RATIO_W}
      height={RATIO_H}
      preload="none"
      muted
      loop
      playsInline
      // 카드 초상은 주 이미지라 이름을 주고, 배너 초상은 장식이라 감춘다.
      {...(decorative
        ? { 'aria-hidden': true as const }
        : { role: 'img' as const, 'aria-label': alt })}
      className={className}
      style={style}
    />
  );
}
