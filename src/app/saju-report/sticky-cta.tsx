'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './saju-report.module.css';

// 하단 고정 버튼은 body 로 portal — 조상 transform(page-transition) 안에 있으면 fixed 가 화면이 아니라 콘텐츠 끝에 붙는다.
export function StickyCta({ label }: { label: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div className={styles.sticky}>
      <a className={styles.primary} href="#order">{label}</a>
    </div>,
    document.body,
  );
}
