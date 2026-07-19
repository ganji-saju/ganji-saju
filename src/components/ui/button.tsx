import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// 2026-07-19 — 공용 버튼을 알약(rounded-full) → **모서리만 살짝 둥근 박스**로.
//   사용자 요청("타원형 말고 모서리만 살짝 둥근 박스"). 이 컴포넌트가 앱 전역 버튼의
//   기본값이라 여기를 안 바꾸면 화면마다 알약/사각이 섞인다.
//   ⚠️ icon* 사이즈는 정사각이라 rounded-full 이 곧 **원형 아이콘 버튼**이다 —
//   각 size 변형에 rounded-full 을 남겨 원형을 유지한다(cn=twMerge 라 뒤 클래스가 이긴다).
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[12px] border border-transparent bg-clip-padding text-base font-semibold whitespace-nowrap transition-all outline-none select-none focus-visible:border-[var(--app-pink)]/55 focus-visible:ring-3 focus-visible:ring-[var(--app-pink)]/24 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-[var(--app-pink)]/70 bg-[var(--app-pink)] text-white shadow-[0_14px_34px_rgba(216,27,114,0.22)] hover:-translate-y-0.5 hover:bg-[var(--app-pink-strong)] hover:shadow-[0_18px_42px_rgba(216,27,114,0.28)]",
        outline:
          "border-[var(--app-pink)]/32 bg-[var(--app-pink-soft)] text-[var(--app-pink-strong)] hover:-translate-y-0.5 hover:bg-white hover:text-[var(--app-ink)] aria-expanded:bg-[var(--app-pink-soft)] aria-expanded:text-[var(--app-pink-strong)]",
        secondary:
          "border-[var(--app-line)] bg-white text-[var(--app-ink)] shadow-[0_10px_24px_rgba(17,17,20,0.05)] hover:-translate-y-0.5 hover:border-[var(--app-pink-line)] hover:bg-[var(--app-pink-soft)] aria-expanded:bg-[var(--app-pink-soft)] aria-expanded:text-[var(--app-ink)]",
        ghost:
          "border-transparent bg-transparent text-[var(--app-copy-muted)] hover:bg-[var(--app-pink-soft)] hover:text-[var(--app-pink-strong)] aria-expanded:bg-[var(--app-pink-soft)] aria-expanded:text-[var(--app-pink-strong)]",
        destructive:
          "border-rose-300/55 bg-rose-50 text-rose-700 hover:-translate-y-0.5 hover:bg-rose-100 focus-visible:border-rose-300 focus-visible:ring-rose-300/20 dark:bg-rose-50 dark:hover:bg-rose-100",
        link: "rounded-none border-transparent px-0 text-[var(--app-pink-strong)] underline-offset-4 hover:text-[var(--app-ink)] hover:underline",
      },
      size: {
        default:
          "h-12 gap-2 px-5 text-[1rem] has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        xs: "h-9 gap-1.5 px-3 text-[0.92rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-10 gap-1.5 px-4 text-[0.96rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 [&_svg:not([class*='size-'])]:size-4",
        lg: "h-[3.35rem] gap-2 px-6 text-[1.08rem] has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        icon: "size-12 rounded-full",
        "icon-xs":
          "size-9 rounded-full in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm":
          "size-10 rounded-full in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-[3.35rem] rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
