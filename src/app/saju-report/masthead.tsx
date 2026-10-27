import styles from './saju-report.module.css';

/** 상단 머리 — 완료 화면과 같이 쓴다. */
export function Masthead({ cta = true }: { cta?: boolean }) {
  return (
    <header className={styles.header}>
      <a className={styles.brand} href="/saju-report">
        <span className={styles.seal} aria-hidden="true">간지</span>
        간지사주
      </a>
      {cta ? <a className={styles.headerLink} href="#order">풀이 신청</a> : null}
    </header>
  );
}
