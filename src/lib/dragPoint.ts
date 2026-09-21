/**
 * Convert a Tauri drag-drop position to CSS pixels. GTK reports logical
 * points already, so on Linux the coordinates pass through unchanged.
 */
export function dragPointToClient(
  x: number,
  y: number,
): { x: number; y: number } {
  return { x, y };
}
