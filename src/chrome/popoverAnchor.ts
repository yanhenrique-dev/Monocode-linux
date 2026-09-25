export type PopoverAnchor =
  | HTMLElement
  | { current: HTMLElement | null }
  | DOMRect
  | { x: number; y: number }
  | null;

type VirtualAnchorRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function virtualAnchor(rect: VirtualAnchorRect) {
  return {
    getBoundingClientRect: () =>
      DOMRect.fromRect({
        x: rect.x,
        y: rect.y,
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
      x: anchor.x,
      y: anchor.y,
      width: anchor.width,
      height: anchor.height,
    });
  }
  return virtualAnchor({
    x: anchor.x,
    y: anchor.y,
    width: 0,
    height: 0,
  });
}

export function anchorElement(anchor: PopoverAnchor): HTMLElement | null {
  if (!anchor) return null;
  if (anchor instanceof HTMLElement) return anchor;
  return "current" in anchor ? anchor.current : null;
}
