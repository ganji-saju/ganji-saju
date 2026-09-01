// vitest 용 no-op. Next.js 의 'server-only' 는 클라이언트 번들에 섞이면 빌드를 깨뜨리는
//   가드일 뿐 런타임 동작이 없다. 테스트(node 환경)에서는 해석만 되면 되므로 빈 모듈로 둔다.
//   이게 없으면 `import 'server-only'` 가 있는 서버 모듈은 **단위 테스트 자체가 불가능**하다.
export {};
