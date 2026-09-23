import {
  useCallback,
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type Ref,
} from "react";
import { Popover as BasePopover } from "@base-ui/react/popover";
import { GlassBackdrop } from "./GlassBackdrop";
import { LAYER } from "../lib/layers";
import {
  useExitAnimation,
  useExperimentalAnimations,
} from "../hooks/useExitAnimation";
import type {
  PopoverAlign,
  PopoverSide,
} from "../lib/popover";

/**
 * A trigger element, a live ref to one, a rect already in viewport
 * coordinates, or a bare point for context menus.
 */
export type PopoverAnchor =
  | HTMLElement
  | { current: HTMLElement | null }
  | DOMRect
  | { x: number; y: number }
  | null;

export type PopoverDismissReason = "outside" | "escape";

type Props = Omit<ComponentPropsWithoutRef<"div">, "style"> & {
  anchor: PopoverAnchor;
  side?: PopoverSide;
  align?: PopoverAlign;
  gap?: number;
  padding?: number;
  width?: number;
  minHeight?: number;
  maxHeight?: number;
  /** Defaults to true. Disable for intrinsic-height surfaces like context menus. */
  constrainHeight?: boolean;
  /** Defaults to `LAYER.popover`; a flyout off an open popover wants higher. */
  layer?: number;
  /** Drops the glass frame and keeps only placement and the content animation. */
  bare?: boolean;
  style?: CSSProperties;
  autoFocus?: boolean;
  /** Wiring this in hands Popover the outside-click and Escape handling. */
  onDismiss?: (reason: PopoverDismissReason) => void;
  dismissOnEscape?: boolean;
  /** A pointer landing inside anything matching this selector is not outside. */
  ignore?: string;
  ref?: Ref<HTMLDivElement>;
};

const FRAME =
  "isolate overflow-hidden rounded-xl border border-content/10 shadow-xl";

/** Floating UI virtual element for rects and bare points. */
function virtualAnchor(rect: {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}) {
  return {
    getBoundingClientRect: () => DOMRect.fromRect(rect),
  };
}

function toBaseAnchor(
  anchor: PopoverAnchor,
): Element | { getBoundingClientRect: () => DOMRect } | null {
  if (!anchor) return null;
  if (anchor instanceof HTMLElement) return anchor;
  if ("current" in anchor) return anchor.current;
  if ("width" in anchor) {
    const rect = anchor;
    return virtualAnchor({
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    });
  }
  const { x, y } = anchor;
  return virtualAnchor({
    left: x,
    top: y,
    right: x,
    bottom: y,
    width: 0,
    height: 0,
  });
}

function anchorElement(anchor: PopoverAnchor): HTMLElement | null {
  if (!anchor) return null;
  if (anchor instanceof HTMLElement) return anchor;
  return "current" in anchor ? anchor.current : null;
}

/**
 * A menu, dropdown, or flyout that escapes its pane: portalled to the body so
 * no local stacking context can paint over it, placed against its anchor with
 * viewport flipping, and animated in from the anchored edge.
 *
 * Positioning runs on Base UI (Floating UI); the public API is unchanged.
 */
export function Popover({
  anchor,
  side = "bottom",
  align = "start",
  gap = 6,
  padding = 8,
  width,
  minHeight,
  maxHeight,
  constrainHeight = true,
  layer = LAYER.popover,
  bare = false,
  className,
  style,
  autoFocus = false,
  onDismiss,
  dismissOnEscape = true,
  ignore,
  ref,
  children,
  ...rest
}: Props) {
  const dismissRef = useRef(onDismiss);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const anchorRef = useRef(anchor);
  anchorRef.current = anchor;
  // Written in an effect, not during render: a discarded concurrent render
  // must never swap the callback the committed tree's dismiss will run.
  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  const animationsEnabled = useExperimentalAnimations();
  const pendingReason = useRef<PopoverDismissReason | null>(null);
  const { closing, requestClose, handleAnimationEnd } = useExitAnimation({
    enabled: animationsEnabled,
    durationMs: 150,
    onExit: () => {
      const reason = pendingReason.current;
      pendingReason.current = null;
      if (reason) dismissRef.current?.(reason);
    },
  });
  const dismiss = useCallback(
    (reason: PopoverDismissReason) => {
      if (!animationsEnabled) {
        dismissRef.current?.(reason);
        return;
      }
      pendingReason.current = reason;
      requestClose();
    },
    [animationsEnabled, requestClose],
  );

  // Escape stays on a window capture listener (old semantics: works no
  // matter where focus sits). Base UI's own escape-key close is ignored in
  // `handleOpenChange` so a dismissal never fires twice.
  useEffect(() => {
    if (!onDismiss || !dismissOnEscape) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      dismiss("escape");
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onDismiss, dismissOnEscape, dismiss]);
  // Outside press stays on our own pointerdown listener (old semantics:
  // close on press, not on click — Base UI defaults to intentional/click
  // dismissal). Base's outside-press is cancelled in `handleOpenChange`.
  useEffect(() => {
    if (!onDismiss) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (popupRef.current?.contains(target)) return;
      if (anchorElement(anchorRef.current)?.contains(target)) return;
      const el =
        target instanceof Element ? target : (target.parentElement ?? null);
      if (ignore && el?.closest(ignore)) return;
      dismiss("outside");
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [onDismiss, ignore, dismiss]);

  const handleOpenChange = useCallback(
    (
      open: boolean,
      details: { reason: string; event: Event; cancel: () => void },
    ) => {
      if (open) return;
      // Owned by the listeners above; never double-dismiss.
      details.cancel();
    },
    [],
  );

  // Frame border compensation, like the old Popover: the glass frame eats
  // 2px that the content max-height must give back (bare surfaces: 0).
  const frameInset = bare ? 0 : 2;
  const contentMaxHeight = constrainHeight
    ? typeof maxHeight === "number"
      ? Math.max(0, maxHeight - frameInset)
      : (maxHeight ?? "calc(100vh - 16px)")
    : undefined;

  return (
    <BasePopover.Root
      open
      modal={false}
      onOpenChange={handleOpenChange}
    >
      {/*
        Base Portal resolves its container in a layout effect, so popup DOM
        lands one commit after mount. Callers that focus on open (pickers)
        already retry on the next frame; keep that contract.
      */}
      <BasePopover.Portal style={{ zIndex: layer }}>
        <BasePopover.Positioner
          anchor={toBaseAnchor(anchor)}
          positionMethod="fixed"
          side={side}
          align={align}
          sideOffset={gap}
          alignOffset={0}
          collisionPadding={padding}
          data-popover-side={side}
          className={bare ? undefined : FRAME}
        >
          {bare ? null : <GlassBackdrop />}
          <BasePopover.Popup
            {...rest}
            ref={(el) => {
              popupRef.current = el;
              if (typeof ref === "function") ref(el);
              else if (ref) ref.current = el;
            }}
            initialFocus={autoFocus}
            // Callers own focus restore (e.g. mute control refocuses its
            // trigger); Base would return focus to whatever held it when
            // the async portal mount settled, usually body.
            finalFocus={false}
            data-popover-side={side}
            style={{
              width,
              minHeight,
              ...(contentMaxHeight != null
                ? { maxHeight: contentMaxHeight }
                : {}),
              ...style,
            }}
            onAnimationEnd={closing ? handleAnimationEnd : undefined}
            className={`${closing ? "popover-closing " : "popover-open "}relative z-[1] outline-none ${className ?? ""}`}
          >
            {children}
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
}
