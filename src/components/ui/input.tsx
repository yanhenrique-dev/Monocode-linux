import type { InputHTMLAttributes, Ref } from "react";
import { cn } from "../../lib/utils";

/**
 * Text input bound to MonoCode tokens. Native element: keeps spellcheck,
 * password managers and IME behavior out of the box; the only addition over
 * a bare input is the shared border/focus treatment.
 */
export function Input({
  className,
  type = "text",
  ref,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  ref?: Ref<HTMLInputElement>;
}) {
  return (
    <input
      ref={ref}
      type={type}
      {...props}
      className={cn(
        "w-full rounded-md border border-content/10 bg-content/5 px-2 py-1 text-[12px] text-content outline-none placeholder:text-content/40 hover:border-content/20 focus:border-accent",
        className,
      )}
    />
  );
}
