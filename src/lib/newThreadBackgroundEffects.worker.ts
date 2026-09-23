/// <reference lib="webworker" />

import type { NewThreadBackgroundEffect } from "./appearance";
import {
  asciiPixels,
  computeLuma,
  ditherPixels,
  halftonePixels,
  nonePixels,
  scanlinePixels,
  type EffectPixels,
} from "./backgroundEffectPixels";

type Source = EffectPixels;

type ProbeRequest = {
  kind: "probe";
  id: number;
};

type LoadRequest = {
  kind: "load";
  id: number;
  sourceKey: string;
  bytes: ArrayBuffer;
};

type RenderRequest = {
  kind: "render";
  id: number;
  sourceKey: string;
  effect: NewThreadBackgroundEffect;
  light: boolean;
};

type WorkerRequest = ProbeRequest | LoadRequest | RenderRequest;

async function probeCapabilities(): Promise<void> {
  if (typeof OffscreenCanvas === "undefined") {
    throw new Error("OffscreenCanvas is not available.");
  }
  const canvas = new OffscreenCanvas(2, 2);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2d context is not available.");
  await canvas.convertToBlob({ type: "image/png" });
}

const sources = new Map<string, Source>();
const rendered = new Map<string, Blob>();

/** Keep decoded sources bounded: each 2048px source holds ~20MiB. */
const MAX_CACHED_REVISIONS = 3;

function revisionOf(key: string): number {
  const match = /[?&]v=(\d+)/.exec(key);
  return match ? Number(match[1]) : 0;
}

function pruneByRevision(map: Map<string, unknown>) {
  const revisions = new Set<number>();
  for (const key of map.keys()) revisions.add(revisionOf(key));
  if (revisions.size <= MAX_CACHED_REVISIONS) return;
  const keep = new Set(
    [...revisions].sort((a, b) => b - a).slice(0, MAX_CACHED_REVISIONS),
  );
  for (const key of map.keys()) {
    if (!keep.has(revisionOf(key))) map.delete(key);
  }
}

function post(id: number, result?: Blob, error?: string) {
  self.postMessage({ id, result, error });
}

async function loadSource(sourceKey: string, bytes: ArrayBuffer) {
  const decoded = await createImageBitmap(new Blob([bytes]));
  const scale = Math.min(1, 2048 / decoded.width, 2048 / decoded.height);
  const width = Math.max(1, Math.round(decoded.width * scale));
  const height = Math.max(1, Math.round(decoded.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Unable to prepare the background image.");
  context.drawImage(decoded, 0, 0, width, height);
  decoded.close();
  const pixels = context.getImageData(0, 0, width, height).data;
  const luma = computeLuma(pixels, width, height);
  sources.set(sourceKey, { width, height, pixels, luma });
  pruneByRevision(sources);
}

async function render(
  sourceKey: string,
  effect: NewThreadBackgroundEffect,
  light: boolean,
) {
  const source = sources.get(sourceKey);
  if (!source) throw new Error("Background source is not loaded.");
  const themeKey = effect === "none" || effect === "dither" ? false : light;
  const cacheKey = `${sourceKey}:${effect}:${themeKey}`;
  const cached = rendered.get(cacheKey);
  if (cached) return cached;
  const pixels =
    effect === "none"
      ? nonePixels(source)
      : effect === "dither"
        ? ditherPixels(source)
        : effect === "ascii"
          ? asciiPixels(source, light)
          : effect === "halftone"
            ? halftonePixels(source, light)
            : scanlinePixels(source, light);
  const canvas = new OffscreenCanvas(source.width, source.height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to render the background effect.");
  context.putImageData(
    new ImageData(pixels, source.width, source.height),
    0,
    0,
  );
  const blob = await canvas.convertToBlob({ type: "image/png" });
  rendered.set(cacheKey, blob);
  pruneByRevision(rendered);
  return blob;
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  try {
    if (event.data.kind === "probe") {
      await probeCapabilities();
      post(event.data.id);
    } else if (event.data.kind === "load") {
      await loadSource(event.data.sourceKey, event.data.bytes);
      post(event.data.id);
    } else {
      post(
        event.data.id,
        await render(event.data.sourceKey, event.data.effect, event.data.light),
      );
    }
  } catch (error) {
    post(
      event.data.id,
      undefined,
      error instanceof Error ? error.message : String(error),
    );
  }
};

export {};
