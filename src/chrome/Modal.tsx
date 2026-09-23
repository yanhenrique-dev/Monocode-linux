import { X } from "./icons";
import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { useLockOverscroll } from "../hooks/useLockOverscroll";
import {
  useExitAnimation,
  useExperimentalAnimations,
} from "../hooks/useExitAnimation";
import { useLocale } from "../lib/locale";
import {
  Dialog,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from "../components/ui/dialog";
import { GlassBackdrop } from "./GlassBackdrop";

export type ModalSize = "sm" | "md";

const WIDTH: Record<ModalSize, string> = {
  sm: "w-[min(420px,calc(100vw-24px))]",
  md: "w-[min(560px,calc(100vw-24px))]",
};

const TOP: Record<ModalSize, string> = {
  sm: "top-[22%]",
  md: "top-[10%]",
};

type Props = {
  onClose: () => void;
  title: string;
  description?: string;
  size?: ModalSize;
  /** Keeps the accessible title while letting focused content own the visual hierarchy. */
  minimalHeader?: boolean;
  /** Hides the header close button (the dialog owns dismissal, e.g. busy forms). */
  hideClose?: boolean;
  dismissible?: boolean;
  /** Extra classes on the panel (fixed height, etc). */
  className?: string;
  children: ReactNode;
  /** Replaces the enter animation with the outro; internal to Modal. */
  panelClassName?: string;
  onPanelAnimationEnd?: (event: {
    target: unknown;
    currentTarget: unknown;
  }) => void;
};

export function ModalPanel({
  onClose,
  title,
  description,
  size = "md",
  minimalHeader = false,
  hideClose = false,
  className,
  children,
  panelClassName,
  onPanelAnimationEnd,
}: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const lockOverscroll = useLockOverscroll<HTMLDivElement>();
  const { t } = useLocale();
  const uid = useId();
  const titleId = `${uid}-title`;
  const descriptionId = description ? `${uid}-desc` : undefined;

  // Focus trap lives in Base UI (Dialog root). Initial focus + restore stay
  // explicit: the app unmounts dialogs while still open, a path where Base
  // skips its own finalFocus restore. Dialogs without a close button focus
  // their own content (e.g. SwitchBranchDialog's textarea).
  useEffect(() => {
    previousFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (!minimalHeader && !hideClose) closeRef.current?.focus();
    return () => {
      previousFocus.current?.focus?.();
      previousFocus.current = null;
    };
  }, [minimalHeader, hideClose]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (
        event.target instanceof Element &&
        event.target.closest("[data-dialog-popover]")
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  return (
    <div
      className={`absolute left-1/2 ${TOP[size]} ${WIDTH[size]} -translate-x-1/2`}
    >
      <DialogPopup
        aria-modal="true"
        initialFocus={false}
        finalFocus={false}
        onMouseDown={(event) => event.stopPropagation()}
        className={`relative isolate flex flex-col overflow-hidden rounded-2xl border border-content/10 shadow-2xl ${className ?? ""}`}
      >
        <GlassBackdrop className="popover-backdrop bg-background-base/55" />
        <div
          onAnimationEnd={onPanelAnimationEnd}
          className={`${
            panelClassName ?? "modal-panel"
          } relative z-[1] flex min-h-0 flex-1 flex-col`}
        >
          <header
            className={
              minimalHeader
                ? "absolute top-3 right-3 z-[2]"
                : "flex shrink-0 items-start gap-2 px-4 pt-3"
            }
          >
            <div
              className={minimalHeader ? "sr-only" : "min-w-0 flex-1 pt-0.5"}
            >
              <DialogTitle
                render={
                  <h2
                    id={titleId}
                    className="text-2xl font-semibold leading-tight text-content"
                  >
                    {title}
                  </h2>
                }
              />
              {description ? (
                <DialogDescription
                  render={
                    <p
                      id={descriptionId}
                      className="mt-0.5 truncate text-[12px] leading-snug text-content/50"
                    >
                      {description}
                    </p>
                  }
                />
              ) : null}
            </div>
            {hideClose ? null : (
              <button
                ref={closeRef}
                type="button"
                aria-label={t("settings.common.close")}
                onClick={onClose}
                className="grid size-7 shrink-0 place-items-center rounded-md text-content/45 hover:bg-content/8 hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <X className="size-3.5" strokeWidth={1.75} />
              </button>
            )}
          </header>
          <div
            ref={lockOverscroll}
            className="min-h-0 flex-1 overflow-y-auto overscroll-none"
          >
            {children}
          </div>
        </div>
      </DialogPopup>
    </div>
  );
}

export function Modal(props: Props) {
  const animationsEnabled = useExperimentalAnimations();
  const { dismissible = true } = props;
  const { closing, requestClose, handleAnimationEnd } = useExitAnimation({
    enabled: animationsEnabled,
    durationMs: 150,
    onExit: props.onClose,
  });
  const requestModalClose = useCallback(() => {
    if (!dismissible) return;
    requestClose();
  }, [dismissible, requestClose]);
  return (
    <Dialog
      open
      modal
      disablePointerDismissal={!dismissible}
      onOpenChange={(open) => {
        if (dismissible && !open) requestModalClose();
      }}
    >
      <DialogPortal>
        <div
          className={`modal-backdrop absolute inset-0 bg-black/40${
            closing ? " modal-backdrop-closing" : ""
          }`}
          onMouseDown={dismissible ? requestModalClose : undefined}
        />
        <ModalPanel
          {...props}
          hideClose={!dismissible || props.hideClose}
          onClose={requestModalClose}
          panelClassName={closing ? "modal-panel-closing" : undefined}
          onPanelAnimationEnd={closing ? handleAnimationEnd : undefined}
        />
      </DialogPortal>
    </Dialog>
  );
}
