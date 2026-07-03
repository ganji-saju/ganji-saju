// 카카오 공유 4019 진단 클라이언트 — 배포된 번들이 실제로 쓰는 키·SDK 상태를 표시하고
// 최소 payload 로 실제 공유를 시도해 결과를 눈으로 확인한다.
'use client';

import { useEffect, useState } from 'react';

const RAW_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? '';

function describeKey(raw: string) {
  if (!raw) return { set: false } as const;
  const trimmed = raw.trim();
  return {
    set: true,
    length: raw.length,
    trimmedLength: trimmed.length,
    hasEdgeWhitespace: raw !== trimmed,
    head: trimmed.slice(0, 6),
    tail: trimmed.slice(-4),
    firstCharCode: raw.charCodeAt(0),
    lastCharCode: raw.charCodeAt(raw.length - 1),
    // 32자 hex = 카카오 앱 키의 일반 형태. 아니면 형태 자체가 이상.
    looksLikeAppKey: /^[0-9a-f]{32}$/.test(trimmed),
  } as const;
}

export function KakaoShareDebugClient() {
  const [state, setState] = useState<{
    origin: string;
    sdkLoaded: boolean;
    initialized: boolean;
    version: string | null;
  } | null>(null);
  const [shareOutcome, setShareOutcome] = useState<string>('');

  useEffect(() => {
    // SDK 로드가 afterInteractive 라 약간 늦을 수 있어 1초 뒤 한 번 더.
    const read = () => {
      const kakao = window.Kakao as (Window['Kakao'] & { VERSION?: string }) | undefined;
      setState({
        origin: window.location.origin,
        sdkLoaded: Boolean(kakao),
        initialized: Boolean(kakao?.isInitialized?.()),
        version: kakao?.VERSION ?? null,
      });
    };
    read();
    const timer = setTimeout(read, 1200);
    return () => clearTimeout(timer);
  }, []);

  function testShare() {
    setShareOutcome('');
    const kakao = window.Kakao;
    if (!kakao?.Share || !kakao.isInitialized()) {
      setShareOutcome('SDK 미가용(미로드 또는 init 안 됨) — 공유 시도 불가');
      return;
    }
    try {
      kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: '간지사주 공유 진단',
          description: '이 카드가 카톡에 뜨면 공유 정상',
          imageUrl: 'https://ganjisaju.kr/images/gangi/og-image.png',
          link: { mobileWebUrl: 'https://ganjisaju.kr', webUrl: 'https://ganjisaju.kr' },
        },
        buttons: [
          { title: '열기', link: { mobileWebUrl: 'https://ganjisaju.kr', webUrl: 'https://ganjisaju.kr' } },
        ],
      });
      setShareOutcome('sendDefault 호출됨 — 카톡/공유창 결과를 확인하세요 (4019 뜨면 그 화면의 UUID 를 기록)');
    } catch (err) {
      setShareOutcome(`sendDefault 예외: ${(err as Error)?.message ?? String(err)}`);
    }
  }

  const key = describeKey(RAW_KEY);

  return (
    <main className="mx-auto max-w-md space-y-4 p-5">
      <h1 className="text-[18px] font-extrabold">카카오 공유 진단</h1>

      <section className="rounded-[12px] border border-[var(--app-line)] bg-white p-4 text-[13.5px] leading-[1.7]">
        <h2 className="font-extrabold">1) 배포된 JS 키 (NEXT_PUBLIC_KAKAO_JS_KEY)</h2>
        {!key.set ? (
          <p className="text-red-600">❌ 미설정 — Vercel env 미주입 또는 재배포 안 됨</p>
        ) : (
          <ul className="mt-1 list-disc pl-5">
            <li>
              값: <code>{key.head}…{key.tail}</code> (trim 후 {key.trimmedLength}자)
            </li>
            <li>
              원본 길이 {key.length}자 · 끝 공백/줄바꿈:{' '}
              {key.hasEdgeWhitespace ? (
                <strong className="text-red-600">있음 ❌ (charCode {key.lastCharCode})</strong>
              ) : (
                '없음 ✅'
              )}
            </li>
            <li>
              32자 hex 형태:{' '}
              {key.looksLikeAppKey ? '맞음 ✅' : <strong className="text-red-600">아님 ❌ — 키 종류/복사 확인</strong>}
            </li>
          </ul>
        )}
        <p className="mt-2 text-[12px] text-[var(--app-copy-muted)]">
          → 카카오 콘솔 [앱 키]의 <strong>JavaScript 키</strong> 앞 6자/뒤 4자와 일치해야 합니다.
        </p>
      </section>

      <section className="rounded-[12px] border border-[var(--app-line)] bg-white p-4 text-[13.5px] leading-[1.7]">
        <h2 className="font-extrabold">2) SDK 상태</h2>
        {state ? (
          <ul className="mt-1 list-disc pl-5">
            <li>접속 origin: <code>{state.origin}</code> (콘솔 등록 도메인과 일치해야 함)</li>
            <li>SDK 로드: {state.sdkLoaded ? '✅' : '❌'}</li>
            <li>init: {state.initialized ? '✅' : '❌'}</li>
            <li>SDK 버전: {state.version ?? '(확인 불가)'}</li>
          </ul>
        ) : null}
      </section>

      <section className="rounded-[12px] border border-[var(--app-line)] bg-white p-4 text-[13.5px] leading-[1.7]">
        <h2 className="font-extrabold">3) 최소 payload 공유 테스트</h2>
        <button
          type="button"
          onClick={testShare}
          className="mt-2 w-full rounded-[10px] px-3 py-2.5 text-[15px] font-extrabold text-white"
          style={{ background: '#191919' }}
        >
          카카오톡 공유 시도
        </button>
        {shareOutcome ? <p className="mt-2">{shareOutcome}</p> : null}
      </section>
    </main>
  );
}
