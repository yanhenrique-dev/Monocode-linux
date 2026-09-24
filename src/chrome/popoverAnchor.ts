export type PopoverAnchor =
  | HTMLElement
  | { current: HTMLElement | null }
  | DOMRect
  | { x: number; y: number }
  | null;

type VirtualAnchorRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function virtualAnchor(rect: VirtualAnchorRect) {
  return {
    getBoundingClientRect: () =>
      DOMRect.fromRect({
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      }),
  };
}

export function toBaseAnchor(
  anchor: PopoverAnchor,
): Element | { getBoundingClientRect: () => DOMRect } | null {
  if (!anchor) return null;
  if (anchor instanceof HTMLElement) return anchor;
  if ("current" in anchor) return anchor.current;
  if ("width" in anchor) {
    return virtualAnchor({
      left: anchor.left,
      top: anchor.top,
      width: anchor.width,
      height: anchor.height,
    });
  }
  return virtualAnchor({
    left: anchor.x,
    top: anchor.y,
    width: 0,
    height: 0,
  });
}

export function anchorElement(anchor: PopoverAnchor): HTMLElement | null {
  if (!anchor) return null;
  if (anchor instanceof HTMLElement) return anchor;
  return "current" in anchor ? anchor.current : null;
}
