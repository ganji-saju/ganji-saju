// vitest 용 next/font/local 대역. 실제 함수는 Next 컴파일러(SWC)가 빌드 때 바꿔 끼우고, 그 밖에서 부르면 예외를 던진다.
//   테스트는 글꼴 파일이 아니라 "어느 변수·클래스를 쓰는가" 만 보면 되므로 고정값을 돌려준다.
export default function localFont() {
  return { className: 'next-font-stub', variable: 'next-font-stub-variable', style: { fontFamily: 'stub' } };
}
