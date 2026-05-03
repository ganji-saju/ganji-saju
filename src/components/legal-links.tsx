import Link from 'next/link';

interface LegalLinksProps {
  className?: string;
}

export default function LegalLinks({ className }: LegalLinksProps) {
  return (
    <span className={className}>
      <Link
        href="/terms"
        className="underline underline-offset-4 transition-colors hover:text-[var(--app-pink-strong)]"
      >
        이용약관
      </Link>{' '}
      및{' '}
      <Link
        href="/privacy"
        className="underline underline-offset-4 transition-colors hover:text-[var(--app-pink-strong)]"
      >
        개인정보처리방침
      </Link>
    </span>
  );
}
