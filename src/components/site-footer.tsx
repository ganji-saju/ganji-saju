import Link from 'next/link';

const companyItems = [
  { label: '회사명', value: '푸꼬컴퍼니' },
  { label: '대표자', value: '김재호' },
  { label: '사업자등록번호', value: '215-27-64715' },
  { label: '주소', value: '서울특별시 중랑구 동일로 909, 3층 301호 일부호(묵동)' },
  { label: '연락처', value: '010-8123-9184', href: 'tel:010-8123-9184' },
];

export default function SiteFooter() {
  return (
    <footer className="site-footer" aria-label="회사 및 서비스 안내">
      <div className="site-footer-inner">
        <div className="site-footer-main">
          <div>
            <div className="site-footer-brand">달빛인생</div>
            <p className="site-footer-copy">
              오늘운세, 사주, 타로, 궁합을 쉽고 빠르게 보는 운세 서비스입니다.
            </p>
          </div>

          <nav className="site-footer-links" aria-label="푸터 링크">
            <Link href="/terms">이용약관</Link>
            <Link href="/privacy">개인정보처리방침</Link>
            <Link href="/pricing">가격 안내</Link>
            <Link href="/notifications">알림 설정</Link>
          </nav>
        </div>

        <dl className="site-footer-company">
          {companyItems.map((item) => (
            <div key={item.label} className="site-footer-company-item">
              <dt>{item.label}</dt>
              <dd>
                {item.href ? <a href={item.href}>{item.value}</a> : item.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="site-footer-notice">
          <p>
            결제, 환불, 보관함, 계정 관련 문의는 위 연락처로 접수해 주세요. 유료 풀이와 코인 이용
            내역은 로그인 계정 기준으로 확인됩니다.
          </p>
          <p>
            달빛인생의 사주·타로·띠운세 콘텐츠는 삶의 흐름을 참고하기 위한 운세 콘텐츠입니다.
            의료, 법률, 투자, 위기상황 판단은 전문 기준과 즉각적인 도움을 우선해 주세요.
          </p>
        </div>

        <div className="site-footer-bottom">
          <span>© 2026 푸꼬컴퍼니. All rights reserved.</span>
          <span>서비스명 달빛인생</span>
        </div>
      </div>
    </footer>
  );
}
