// 2026-08-31 — 총평 프리워밍 재도입 방지 가드.
//
//   /api/readings POST 가 after() 로 generateTotalReview 를 미리 돌리던 코드는
//   결과 페이지의 on-demand 생성과 **같은 키로 동시에 miss** 해 3섹션을 두 번 만들었다
//   (캐시 스토어에 in-flight 잠금이 없다). "캐시를 데운다" 는 의도와 정반대로 비용을 2배로 만든다.
//   다시 넣고 싶다면 먼저 in-flight 잠금(또는 페이지 쪽 생성 제거)이 있어야 한다.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('/api/readings 는 총평 LLM 을 미리 생성하지 않는다', () => {
  it('generateTotalReview / after 를 호출하지 않는다', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/app/api/readings/route.ts'), 'utf8');
    // 주석은 설명하느라 이름을 그대로 쓴다 — 코드만 본다.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toMatch(/\bgenerateTotalReview\s*\(/);
    expect(code).not.toMatch(/\bafter\s*\(/);
  });
});
