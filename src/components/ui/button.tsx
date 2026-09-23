import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, Ref } from "react";
import { cn } from "../../lib/utils";

/**
 * shadcn-style Button bound to MonoCode runtime tokens.
 * `default` reuses the existing `.primary-action` class so the visual
 * treatment (white/dark, light, user-accent) stays identical.
 * `secondary` mirrors the old SecondaryButton; `destructive` its danger.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md text-[12px] font-medium whitespace-nowrap transition-colors disabled:cursor-default disabled:opacity-40 [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "primary-action px-2.5 py-1",
        secondary:
          "border border-content/10 px-2.5 py-1 text-content/70 hover:bg-content/10 hover:text-content",
        destructive:
          "border border-content/10 px-2.5 py-1 text-red-400 hover:border-red-400/40 hover:bg-red-400/10",
        outline:
          "border border-content/15 px-2.5 py-1 text-content hover:bg-content/8",
        ghost: "px-2 py-1 text-content/70 hover:bg-content/10 hover:text-content",
      },
      size: {
        default: "",
        sm: "px-2 py-0.5 text-[11px]",
        icon: "size-7 p-0",
      },
    },
    defaultVariants: { variant: "secondary", size: "default" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    /** React 19 ref-as-prop, forwarded to the underlying button. */
    ref?: Ref<HTMLButtonElement>;
  };

export function Button({
  variant,
  size,
  type = "button",
  className,
  ref,
  ...props
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
