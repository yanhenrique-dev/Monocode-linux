import { composeToolTitle } from "./harness/preview";
import { displayPath } from "./paths";
import type { Block } from "./session";

/** Phase 5 (clean-architecture): label ownership lives in lib so lib callers
 * (approvalToast) don't depend on the surfaces layer. UI re-exports it. */
export function toolCallLabel(block: Block, cwd?: string): string {
  const preview = block.tool?.preview;
  const path = preview?.path
    ? displayPath(preview.path, cwd)
    : preview?.fileName;
  return (
    composeToolTitle({
      kind: block.tool?.kind,
      title: block.text || block.tool?.title,
      path,
      query: preview?.query,
      previewKind: preview?.kind,
      cwd,
    }) || "Working"
  );
}
