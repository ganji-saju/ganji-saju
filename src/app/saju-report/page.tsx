// 한 장짜리 랜딩(대표 수정 요청 2026-10-20 · 설계 docs/superpowers/specs/2026-10-21-one-page-landing-design.md).
//   순서: 사주를 보는 이유 → 기대감 → 상품 → 상담사 → 추천 → 후기 → 주문 → 안내. 로그인 없이 주문한다.
import type { Metadata } from 'next';
import Image from 'next/image';
import SiteFooter from '@/components/site-footer';
import { getPriceDisplayMap } from '@/lib/payments/price-display';
import { getReportBankAccount } from '@/lib/report-orders/bank-account';
import { REPORT_PACKAGE_BY_PRODUCT, maskName, type ReportProduct } from '@/lib/report-orders/report-order';
import {
  ABOUT, COUNSELOR, DISCLAIMER, FAQ, GUIDE, HERO, PHOTO_NOTE, PRICE_NOTE, PRODUCTS_TITLE, PRODUCT_CARDS,
  RECOMMEND, REVIEWS, WHAT, WHY,
} from './landing-content';
import { OrderForm, type ReportPrices } from './order-form';
import { StickyCta } from './sticky-cta';
import styles from './saju-report.module.css';

const TITLE = '간지사주 — 종합사주·2027 신년운세';
export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: '생년월일시로 보는 종합사주와 2027 신년운세. 자격을 갖춘 상담사가 확인해 문자·이메일로 보내 드립니다.',
  openGraph: { title: TITLE, images: ['/saju-report/hero.webp'] },
};
export const dynamic = 'force-dynamic';

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

function Photo({ src, alt, eager = false }: { src: string; alt: string; eager?: boolean }) {
  return (
    <figure className={styles.figure}>
      <Image className={styles.image} src={src} alt={alt} width={1200} height={670} sizes="(max-width: 640px) 100vw, 640px" loading={eager ? 'eager' : 'lazy'} />
      <figcaption className={styles.photoNote}>{PHOTO_NOTE}</figcaption>
    </figure>
  );
}

export default async function SajuReportPage() {
  const display = await getPriceDisplayMap();
  const priceOf = (product: ReportProduct) => {
    const d = display[REPORT_PACKAGE_BY_PRODUCT[product]];
    return { price: d.value, compareAt: d.compareValue };
  };
  const prices: ReportPrices = { lifetime: priceOf('lifetime'), 'new-year': priceOf('new-year') };
  const bankEnabled = getReportBankAccount() !== null;

  return (
    <div className={styles.page}>
      <a className={styles.header} href="/saju-report">간지사주</a>

      <section className={styles.section}>
        <Photo src="/saju-report/hero.webp" alt="사주 책을 펼쳐 놓고 풀이를 적는 모습" eager />
        {HERO.questions.map((q) => <p key={q} className={styles.question}>{q}</p>)}
        <h1 className={styles.h1}>{HERO.title}</h1>
        <a className={styles.primary} href="#order">{HERO.cta}</a>
      </section>

      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <Photo src="/saju-report/why.webp" alt="고민하는 딸의 어깨에 손을 얹은 어머니" />
        <p className={styles.p}>{WHY}</p>
      </section>

      <section className={styles.section}>
        <Photo src="/saju-report/what.webp" alt="사주 명식표에 풀이를 적는 손" />
        <p className={styles.p}>{WHAT}</p>
      </section>

      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <Photo src="/saju-report/about.webp" alt="책상에서 사주 풀이를 정리하는 모습" />
        <h2 className={styles.h2}>{ABOUT.title}</h2>
        <p className={styles.lead}>{ABOUT.lead}</p>
        {ABOUT.paragraphs.map((p) => <p key={p} className={styles.p}>{p}</p>)}
        <p className={styles.lead}>{ABOUT.closing}</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>{PRODUCTS_TITLE}</h2>
        {(['lifetime', 'new-year'] as const).map((id) => {
          const card = PRODUCT_CARDS[id];
          const price = prices[id];
          return (
            <article key={id} className={styles.productCard}>
              <p className={styles.productLead}>{card.lead} →</p>
              <h3 className={styles.productName}>{card.name}</h3>
              <p className={styles.priceLine}>
                {price.compareAt ? <s className={styles.compare}>정가 {won(price.compareAt)}</s> : null}
                <strong className={styles.price}>{won(price.price)}</strong>
              </p>
              <p className={styles.pages}>{card.pages}</p>
              <div className={styles.productImages}>
                {card.images.map((img) => (
                  <Image key={img.src} className={styles.image} src={img.src} alt={img.alt} width={img.width} height={img.height} sizes="(max-width: 640px) 100vw, 640px" />
                ))}
              </div>
              <a className={styles.primary} href={`#order-${id}`}>이 상품 선택</a>
            </article>
          );
        })}
        <p className={styles.box}>{PRICE_NOTE}</p>
      </section>

      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <Photo src="/saju-report/certificates.webp" alt="액자에 넣은 자격증 다섯 장" />
        <p className={styles.p}>{COUNSELOR.body}</p>
        <div className={styles.box}>
          <strong>{COUNSELOR.certificatesNote}</strong>
          <ul className={styles.certList}>
            {COUNSELOR.certificates.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>{RECOMMEND.title}</h2>
        <p className={styles.p}>{RECOMMEND.lead}</p>
        <ol className={styles.recommendList}>
          {RECOMMEND.items.map((item, i) => (
            <li key={item}><span className={styles.num}>{String(i + 1).padStart(2, '0')}</span>{item}</li>
          ))}
        </ol>
        <p className={styles.lead}>{RECOMMEND.closing}</p>
      </section>

      {REVIEWS.length > 0 ? (
        <section className={`${styles.section} ${styles.sectionAlt}`}>
          <h2 className={styles.h2}>이용하신 분들의 후기</h2>
          {REVIEWS.map((r) => (
            <blockquote key={r.text} className={styles.review}>
              <p className={styles.reviewName}>{maskName(r.name)}{r.rating ? ` · ${'★'.repeat(r.rating)}` : ''}</p>
              <p className={styles.p}>{r.text}</p>
            </blockquote>
          ))}
        </section>
      ) : null}

      <section id="order" className={styles.section}>
        <span id="order-lifetime" />
        <span id="order-new-year" />
        <h2 className={styles.h2}>풀이 신청</h2>
        <OrderForm prices={prices} bankEnabled={bankEnabled} />
      </section>

      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <h2 className={styles.h2}>{GUIDE.title}</h2>
        {GUIDE.items.map((item) => <p key={item} className={styles.p}>{item}</p>)}
        <h3 className={styles.h3}>자주 묻는 질문</h3>
        {FAQ.map((f) => (
          <details key={f.q} className={styles.faq}>
            <summary>{f.q}</summary>
            <p className={styles.p}>{f.a}</p>
          </details>
        ))}
        <p className={styles.small}>{DISCLAIMER}</p>
        <p className={styles.small}>풀이 본문은 사주 계산과 AI로 작성하고, 상담사가 확인한 뒤 보내 드립니다.</p>
        <nav className={styles.links} aria-label="정책 안내">
          <a href="/terms">이용약관</a>
          <a href="/privacy">개인정보처리방침</a>
          <a href="/refund-policy">환불 정책</a>
          <a href="/ai-disclaimer">AI 이용 안내</a>
          <a href="/commerce-disclosure">사업자 정보</a>
        </nav>
      </section>

      <SiteFooter />
      <StickyCta label="풀이 신청하기" />
    </div>
  );
}
