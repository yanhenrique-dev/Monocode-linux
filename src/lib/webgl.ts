/** Probe the current environment for a usable WebGL2 context. */
export function supportsWebGL2(probe?: () => unknown): boolean {
  if (probe) return probeWebGL2(probe);
  if (typeof document === "undefined") return false;
  if (webgl2Support !== null) return webgl2Support;
  webgl2Support = probeWebGL2(() => {
    const canvas = document.createElement("canvas");
    return canvas.getContext("webgl2");
  });
  return webgl2Support;
}

let webgl2Support: boolean | null = null;

function probeWebGL2(probe: () => unknown): boolean {
  try {
    const gl = probe();
    // Lose the test context immediately; some drivers cap live contexts.
    const lose = (
      gl as unknown as { getExtension?: (name: string) => unknown }
    )?.getExtension?.("WEBGL_lose_context") as
      | { loseContext?: () => void }
      | undefined;
    lose?.loseContext?.();
    return gl != null;
  } catch {
    return false;
  }
}
