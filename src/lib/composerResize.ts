/** Matches the composer's `max-h-40`, so the field stops growing where it clips. */
export const COMPOSER_MAX_HEIGHT = 160;

type Resizable = {
  style: { height: string };
  scrollHeight: number;
};

/**
 * A hidden tab stays mounted with no layout box, so it reports 0 here.
 * Skips the write when the height already matches: setting `auto` +
 * reading `scrollHeight` forces a sync layout on every keystroke otherwise.
 */
export function resizeComposer(el: Resizable) {
  if (el.scrollHeight === 0) return;
  const next = `${Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT)}px`;
  if (el.style.height === next) return;
  el.style.height = "auto";
  el.style.height = next;
}
