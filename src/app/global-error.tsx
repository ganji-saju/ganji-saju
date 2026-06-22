// 2026-05-14: root error boundary. layout/template 단에서 throw 된 에러까지
// 잡아낸다. 자체 <html>/<body> 가 필수 (next.js 규약).
// 내부 디자인 토큰은 사용 불가 (layout 이 mount 되지 않은 상태일 수 있음)
// → inline style 로 최소 안전 디자인만 적용.
'use client';

import { useEffect } from 'react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[global error boundary]', error);
  }, [error]);

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fff',
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Noto Sans KR', 'Segoe UI', sans-serif",
          color: '#111114',
          padding: '24px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 420,
            padding: 24,
            borderRadius: 20,
            border: '1px solid rgba(198,69,69,0.22)',
            background: 'linear-gradient(180deg, #fdecec 0%, #ffffff 100%)',
            textAlign: 'center',
            boxShadow: '0 22px 50px -28px rgba(198,69,69,0.22)',
          }}
        >
          <div
            style={{
              margin: '0 auto',
              display: 'grid',
              placeItems: 'center',
              width: 64,
              height: 64,
              borderRadius: '999px',
              background: '#fff',
              color: '#c64545',
              fontSize: 34,
              fontWeight: 800,
              border: '1px solid rgba(198,69,69,0.22)',
              boxShadow: '0 14px 28px rgba(198,69,69,0.16)',
            }}
          >
            !
          </div>
          <div
            style={{
              marginTop: 12,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#c64545',
            }}
          >
            여러분의 잘못이 아니에요
          </div>
          <h1
            style={{
              marginTop: 4,
              fontSize: 22,
              fontWeight: 800,
              lineHeight: 1.3,
              color: '#111114',
              wordBreak: 'keep-all',
            }}
          >
            앱이 잠깐 멈췄어요
          </h1>
          <p
            style={{
              marginTop: 8,
              fontSize: 13,
              lineHeight: 1.7,
              color: 'rgba(17,17,20,0.66)',
              wordBreak: 'keep-all',
            }}
          >
            새로고침하거나 잠시 후 다시 들어와 주세요. 같은 화면이 계속
            안 보이면 카카오/전화로 알려주세요.
          </p>
          {error?.digest ? (
            <p
              style={{
                marginTop: 6,
                fontSize: 10.5,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                color: 'rgba(17,17,20,0.74)',
              }}
            >
              오류 코드: {error.digest}
            </p>
          ) : null}

          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 20,
              width: '100%',
              minHeight: 48,
              padding: '0 20px',
              borderRadius: '9999px',
              border: 'none',
              background: '#ff4f9a',
              color: '#fff',
              fontSize: 14,
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 12px 28px rgba(216,27,114,0.32)',
            }}
          >
            다시 시도하기
          </button>
        </div>
      </body>
    </html>
  );
}
