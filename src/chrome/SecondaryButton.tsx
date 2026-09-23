import type { ComponentPropsWithRef } from "react";
import { Button } from "../components/ui/button";

type Props = Omit<ComponentPropsWithRef<"button">, "className"> & {
  danger?: boolean;
};

/** Wrapper over ui/Button preserving the old SecondaryButton API. */
export function SecondaryButton({
  danger = false,
  type = "button",
  children,
  ...props
}: Props) {
  return (
    <Button
      {...props}
      type={type}
      variant={danger ? "destructive" : "secondary"}
    >
      {children}
    </Button>
  );
}
