// 카카오톡 문의하기 버튼 — 모든 '메일 문의'를 대체하는 단일 CTA.
//   링크는 KAKAO_INQUIRY_URL(단일 소스) 하나만 쓴다. 스타일은 className 으로 상황별 오버라이드.
//   기본은 카카오 옐로우(#FEE500) 풀폭 버튼 — '카카오톡'임을 색으로 즉시 인지.
import { KAKAO_INQUIRY_URL } from '@/lib/kakao/channel';

export function KakaoInquiryButton({
  label = '카카오톡으로 문의하기',
  className,
  fullWidth = true,
}: {
  label?: string;
  className?: string;
  fullWidth?: boolean;
}) {
  return (
    <a
      href={KAKAO_INQUIRY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={
        className ??
        `inline-flex ${
          fullWidth ? 'w-full' : ''
        } h-12 items-center justify-center gap-2 rounded-[12px] bg-[#FEE500] px-5 text-[16.1px] font-extrabold text-[#191919] shadow-[0_8px_20px_rgba(0,0,0,0.12)] transition-transform active:scale-[0.99]`
      }
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 3C6.9 3 3 6.24 3 10.2c0 2.52 1.68 4.74 4.2 6.03-.15.54-.66 2.28-.72 2.55 0 0-.03.18.12.24.15.06.3-.06.3-.06.36-.06 2.52-1.65 3.09-2.04.63.09 1.29.15 1.71.15 5.1 0 9-3.24 9-7.2S17.1 3 12 3Z" />
      </svg>
      {label}
    </a>
  );
}
