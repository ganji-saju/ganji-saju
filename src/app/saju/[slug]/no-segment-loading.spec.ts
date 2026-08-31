// 2026-08-31 — "사주 로딩 화면이 두 번 뜬다" 재발 방지 가드.
//
//   /saju/new 제출 오버레이는 router.push 뒤에도 남아 있다(중복 제출 방지 겸). 그런데 이동 대상
//   세그먼트에 loading.tsx 가 있으면 Next 가 그 폴백을 **즉시** 그려서 오버레이가 사라지고
//   두 번째 로딩 화면이 뜬다 — 문구를 똑같이 맞춰도(2026-08-30 #716) "또 떴다" 로 보인다.
//   결과가 올 때까지 오버레이 하나만 보이게 하려면 이 세그먼트엔 loading.tsx 가 없어야 한다.
//
//   ⚠️ 직접 링크/새로고침에 브랜드 스피너를 주고 싶어서 다시 만들고 싶어질 것이다 — 그러면
//      제출 흐름의 두 번째 화면이 그대로 돌아온다. 대신 첫 화면 전 DB 호출을 병렬로 유지해
//      대기 자체를 줄인다(page.tsx Promise.all).
//   premium/print/loading.tsx 는 별개 흐름(PDF 클릭)이라 대상이 아니다.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('/saju/[slug] 세그먼트에 loading.tsx 를 두지 않는다', () => {
  it('loading.tsx 가 없다', () => {
    const file = path.join(process.cwd(), 'src/app/saju/[slug]/loading.tsx');
    expect(
      fs.existsSync(file),
      'loading.tsx 가 생기면 제출 오버레이 뒤에 두 번째 로딩 화면이 뜬다(2026-08-31 재제보)'
    ).toBe(false);
  });

  it('제출 오버레이는 이동이 끝날 때까지 남는다 — 성공 경로에서 submitting 을 되돌리지 않는다', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/app/saju/new/saju-new-client.tsx'), 'utf8');
    // router.push 와 catch 사이(성공 경로)에 setSubmitting(false) 가 있으면 폼이 잠깐 되살아나 깜빡인다.
    const success = src.slice(src.indexOf('router.push('), src.indexOf('} catch'));
    expect(success).not.toMatch(/setSubmitting\(false\)/);
  });
});
