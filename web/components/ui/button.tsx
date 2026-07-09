import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Per DESIGN.md § 3.1:
//   Primary     — bg accent, fg on-accent           (one per screen)
//   Secondary   — surface + 1 px border-strong      (default choice)
//   Outline     — alias for Secondary (back-compat)
//   Ghost       — transparent, hover to surface-2   (toolbar / row actions)
//   Destructive — surface + destructive border      (delete / remove)
//   Link        — text accent, underline on hover
//
// Sizes (DESIGN.md § 3.1):
//   sm  32 px  (table row actions, filter chips)
//   md  40 px  (default — admin toolbars, most CTAs)
//   lg  48 px  (employee-facing weekly CTA)
//
// `default` and `xs` are back-compat aliases used across the app; keep them.
const buttonVariants = cva(
  [
    "group/button inline-flex shrink-0 items-center justify-center",
    "rounded-lg border border-transparent bg-clip-padding",
    "text-sm font-medium whitespace-nowrap",
    "transition-colors outline-none select-none",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]",
    "active:not-aria-[haspopup]:translate-y-px",
    "disabled:pointer-events-none disabled:opacity-50",
    "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary),black_8%)]",
        outline:
          "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-2)] aria-expanded:bg-[var(--color-surface-2)]",
        secondary:
          "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-2)] aria-expanded:bg-[var(--color-surface-2)]",
        ghost:
          "text-[var(--color-text)] hover:bg-[var(--color-surface-2)] aria-expanded:bg-[var(--color-surface-2)]",
        destructive:
          "border-[color-mix(in_oklch,var(--color-destructive),transparent_70%)] bg-[var(--color-surface)] text-[var(--color-destructive)] hover:bg-[color-mix(in_oklch,var(--color-destructive),transparent_94%)]",
        link: "text-[var(--color-accent)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs:  "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm:  "h-8 gap-1.5 px-3 text-[13px]",
        md:  "h-10 gap-2 px-4 [&_svg:not([class*='size-'])]:size-4",
        lg:  "h-12 gap-2 px-5 text-[15px] [&_svg:not([class*='size-'])]:size-[18px]",
        icon:      "size-8",
        "icon-xs": "size-6 rounded-[min(var(--radius-md),10px)] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
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
