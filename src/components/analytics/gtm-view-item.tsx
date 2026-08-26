'use client';
// 2026-08-26 — 상품 상세 노출 시 GA4 view_item 1회 발사.
//
//   서버 컴포넌트(사주 결과·체크아웃 요약)에서도 쓸 수 있도록 **렌더 없는 클라이언트 자식**으로
//   만든다. 부모를 통째로 클라이언트로 바꾸면 서버 렌더 이점을 잃는다.
//
//   ⚠️ 1회만 — StrictMode 이중 마운트·리렌더에 중복 발사되면 view_item 이 부풀어
//   상세→결제 전환율이 반토막으로 보인다. 키 단위로 ref 를 잠근다.
import { useEffect, useRef } from 'react';
import { gtmViewItem, type GtmItem } from '@/lib/analytics/gtm';

export function GtmViewItem({
  productType,
  value,
  itemName,
  itemCategory,
}: {
  /** 카탈로그 packageId — purchase 의 product_type 과 같은 어휘여야 퍼널이 이어진다. */
  productType: string;
  value: number;
  itemName: string;
  itemCategory: string;
}) {
  const firedFor = useRef<string | null>(null);

  useEffect(() => {
    const key = `${productType}:${value}`;
    if (firedFor.current === key) return;
    firedFor.current = key;

    const items: GtmItem[] = [
      { item_id: productType, item_name: itemName, item_category: itemCategory, price: value, quantity: 1 },
    ];
    gtmViewItem(productType, value, items);
  }, [productType, value, itemName, itemCategory]);

  return null;
}
