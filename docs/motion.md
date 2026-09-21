# Motion language

Single source for enter/exit timing. Surfaces share one voice; the
center pane never slides sideways.

## Tokens (`src/index.css :root`)

- `--motion-in: 180ms` — enter (mount, open, expand).
- `--motion-out: 150ms` — exit (close, collapse, dismiss).
- `--motion-ease: cubic-bezier(0.16, 1, 0.3, 1)` — all surfaces
  (popover, modal, sidebar, center pane).
- `--motion-ease-out: cubic-bezier(0.22, 1, 0.36, 1)` — fold only
  (larger travel, needs the extra settle).
- `--motion-fold-in: 220ms`, `--motion-fold-out: 180ms` — work fold.
- `--motion-reorder-duration: 160ms` — pointer drag settle (read by
  `useAnimatedReorder` via `motion.ts`).
- `--motion-feedback-duration: 120ms` — hover/press color feedback.

## Rules

- Enter fills `backwards` (resting state is the truth, no retained
  transform). Exit fills `forwards` while mounted. Never `both` on a
  surface that receives hover — a retained composited state makes
  repaints hitch.
- Slide is edge-anchored and small:
  - popover: 8px toward its side + `scale(0.94)`.
  - modal panel: `translateY(8px) + scale(0.98)`.
  - sidebar (leading edge): `translateX(-12px)`.
  - center file pane: `translateY(4px)` only — no lateral slide.
- Fold animates `grid-template-rows` only, never opacity on the whole
  block (big fade reads as flash). `contain: layout paint` while
  animating; children drop `overflow: hidden` once open.
- Exit must match its JS fallback: `useExitAnimation durationMs` equals
  the CSS out duration (150ms), so no invisible mounted gap.
- First mount is dry: sidebar/file-pane skip the intro on boot and
  animate only on later transitions.
- `prefers-reduced-motion: reduce` disables all of the above.
- Mascot playfulness is capped: `happy` may bounce (720ms max),
  `sad/spark/tear` stay under 400ms.
