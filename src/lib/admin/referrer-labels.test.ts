// 2026-08-26 회귀 가드 — 유입 referrer 라벨/그룹.
//   핵심 계약: 링크인바이오를 거친 유입을 그 **위** 채널로 둔갑시키지 않는다.
import assert from 'node:assert/strict';
import { groupReferrers, resolveReferrerGroup } from './referrer-labels';

declare const test: (name: string, fn: () => void) => void;

test('인포크링크는 인포크링크로 — 인스타로 뭉뚱그리지 않는다', () => {
  assert.deepEqual(resolveReferrerGroup('inpock.link'), { key: 'inpock', label: '인포크링크' });
  assert.deepEqual(resolveReferrerGroup('link.inpock.app'), {
    key: 'inpock',
    label: '인포크링크',
  });
  assert.notEqual(resolveReferrerGroup('inpock.link').label, '인스타그램');
});

test('같은 서비스의 여러 도메인은 한 줄로 접힌다', () => {
  const rows = groupReferrers([
    { host: 'inpock.link', visitors: 12 },
    { host: 'link.inpock.app', visitors: 8 },
    { host: 'l.instagram.com', visitors: 5 },
  ]);
  assert.deepEqual(rows[0], { key: 'inpock', label: '인포크링크', visitors: 20 });
  assert.deepEqual(rows[1], { key: 'instagram', label: '인스타그램', visitors: 5 });
});

test('네이버는 표면별로 쪼갠다 — 검색 유입과 블로그 유입은 다른 일', () => {
  assert.equal(resolveReferrerGroup('blog.naver.com').key, 'naver-blog');
  assert.equal(resolveReferrerGroup('cafe.naver.com').key, 'naver-cafe');
  assert.equal(resolveReferrerGroup('search.naver.com').key, 'naver-search');
  assert.equal(resolveReferrerGroup('m.naver.com').key, 'naver');
});

test('referrer 없음은 직접 유입으로 표기(버리지 않는다)', () => {
  assert.equal(resolveReferrerGroup('(direct)').key, '(direct)');
  assert.equal(resolveReferrerGroup('').label, '직접 유입(referrer 없음)');
});

test('모르는 도메인은 원본 host 유지 — 억지 라벨을 만들지 않는다', () => {
  assert.deepEqual(resolveReferrerGroup('some-blog.example.com'), {
    key: 'some-blog.example.com',
    label: 'some-blog.example.com',
  });
});

test('정렬: 방문자 내림차순, 동률이면 키 오름차순(결정론)', () => {
  const rows = groupReferrers([
    { host: 'kakao.com', visitors: 3 },
    { host: 'daum.net', visitors: 3 },
    { host: 'google.com', visitors: 9 },
  ]);
  assert.deepEqual(
    rows.map((r) => r.key),
    ['google', 'daum', 'kakao']
  );
});
