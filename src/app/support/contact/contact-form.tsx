// 2026-07-27 — 1:1 문의를 카카오톡 채널로 단일화. 기존 mailto 폼은 폐기(사용자 요청).
//   모든 문의는 KAKAO_INQUIRY_URL(단일 소스) 로 연결한다.
import { KakaoInquiryButton } from '@/components/support/kakao-inquiry-button';

export function ContactForm() {
  return (
    <section
      className="grid gap-3 rounded-[18px] border bg-white p-5 text-center"
      style={{ borderColor: 'var(--app-line)' }}
    >
      <div className="text-[41.4px]" aria-hidden="true">
        💬
      </div>
      <h2 className="text-[18.4px] font-extrabold text-[var(--app-ink)]">
        카카오톡으로 문의해 주세요
      </h2>
      <p
        className="text-[14.4px] leading-[1.65] text-[var(--app-copy-muted)]"
        style={{ wordBreak: 'keep-all' }}
      >
        결제·구독·풀이·계정 등 모든 문의는 카카오톡 채널로 받습니다. 아래 버튼을 누르면 바로 상담이
        연결됩니다.
      </p>
      <KakaoInquiryButton label="카카오톡으로 문의하기" />
    </section>
  );
}
