/// <reference types="vite/client" />

import type { NewThreadBackgroundEffect } from "./appearance";
import {
  asciiPixels,
  ditherPixels,
  halftonePixels,
  computeLuma,
  nonePixels,
  scanlinePixels,
} from "./backgroundEffectPixels";

type WorkerResponse = { id: number; result?: Blob; error?: string };

let worker: Worker | null = null;
let nextRequestId = 0;
let appliedRevision = 0;
let activeObjectUrl: string | null = null;
const pending = new Map<
  number,
  { resolve: (result?: Blob) => void; reject: (error: Error) => void }
>();
const loadedSources = new Map<string, Promise<void>>();
const effectCache = new Map<string, Promise<Blob>>();

/** Keep rendered blobs bounded: each source holds decoded pixels + blobs. */
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

function backgroundWorker() {
  if (worker) return worker;
  worker = new Worker(
    new URL("./newThreadBackgroundEffects.worker.ts", import.meta.url),
    { type: "module" },
  );
  worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
    const request = pending.get(data.id);
    if (!request) return;
    pending.delete(data.id);
    if (data.error) request.reject(new Error(data.error));
    else request.resolve(data.result);
  };
  // A dead worker must not hang renders: reject everything pending and drop
  // the instance so the next call retries (or falls back to main thread).
  const failPending = (reason: string) => {
    for (const [id, entry] of pending) {
      pending.delete(id);
      entry.reject(new Error(reason));
    }
    loadedSources.clear();
    effectCache.clear();
    const failed = worker;
    worker = null;
    failed?.terminate();
  };
  worker.onerror = () => failPending("The background effect worker failed.");
  worker.onmessageerror = () =>
    failPending("The background effect worker sent an unreadable message.");
  return worker;
}

/**
 * Whether the worker path can actually render here. WebKitGTK lacks
 * OffscreenCanvas, so the probe fails there and every render below runs on
 * the main thread with a plain canvas instead. Cached after the first call.
 */
let capability: Promise<boolean> | null = null;

function ensureWorkerCapable(): Promise<boolean> {
  if (!capability) {
    capability = (async () => {
      try {
        const probe = request({ kind: "probe" });
        const timeout = new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error("probe timeout")), 4000);
        });
        await Promise.race([probe, timeout]);
        return true;
      } catch {
        return false;
      }
    })();
  }
  return capability;
}

function request(message: object, transfer?: Transferable[]) {
  const id = ++nextRequestId;
  return new Promise<Blob | undefined>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    backgroundWorker().postMessage({ ...message, id }, transfer ?? []);
  });
}

function forgetOnReject<K>(map: Map<K, Promise<unknown>>, key: K) {
  const entry = map.get(key);
  entry?.catch(() => {
    if (map.get(key) === entry) map.delete(key);
  });
}

async function fetchSourceBytes(src: string): Promise<ArrayBuffer> {
  const response = await fetch(src);
  if (!response.ok) throw new Error("Unable to read the background image.");
  return response.arrayBuffer();
}

async function ensureSource(sourceKey: string, src: string) {
  let loading = loadedSources.get(sourceKey);
  if (!loading) {
    loading = fetchSourceBytes(src).then(async (bytes) => {
      await request({ kind: "load", sourceKey, bytes }, [bytes]);
    });
    loadedSources.set(sourceKey, loading);
    pruneByRevision(loadedSources);
    forgetOnReject(loadedSources, sourceKey);
  }
  return loading;
}

function decodeImageElement(
  bytes: ArrayBuffer,
): Promise<{ image: CanvasImageSource; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([bytes]));
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ image, width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to decode the background image."));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob === "function") {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Unable to encode the background effect."));
      }, "image/png");
      return;
    }
    fetch(canvas.toDataURL("image/png"))
      .then((response) => response.blob())
      .then(resolve, reject);
  });
}

/** Main-thread render for engines without worker OffscreenCanvas. */
async function renderOnMainThread(
  bytes: ArrayBuffer,
  effect: NewThreadBackgroundEffect,
  light: boolean,
): Promise<Blob> {
  let decoded: { image: CanvasImageSource; width: number; height: number };
  try {
    const bitmap = await createImageBitmap(new Blob([bytes]));
    decoded = { image: bitmap, width: bitmap.width, height: bitmap.height };
  } catch {
    decoded = await decodeImageElement(bytes);
  }
  const scale = Math.min(1, 2048 / decoded.width, 2048 / decoded.height);
  const width = Math.max(1, Math.round(decoded.width * scale));
  const height = Math.max(1, Math.round(decoded.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Unable to prepare the background image.");
  context.drawImage(decoded.image, 0, 0, width, height);
  if ("close" in decoded.image && typeof decoded.image.close === "function") {
    (decoded.image as ImageBitmap).close();
  }
  const pixels = context.getImageData(0, 0, width, height).data;
  const source = {
    width,
    height,
    pixels,
    luma: computeLuma(pixels, width, height),
  };
  const transformed =
    effect === "none"
      ? nonePixels(source)
      : effect === "dither"
        ? ditherPixels(source)
        : effect === "ascii"
          ? asciiPixels(source, light)
          : effect === "halftone"
            ? halftonePixels(source, light)
            : scanlinePixels(source, light);
  context.putImageData(new ImageData(transformed, width, height), 0, 0);
  return canvasToBlob(canvas);
}

export async function prepareNewThreadBackgroundEffect(
  sourceKey: string,
  src: string,
  effect: NewThreadBackgroundEffect,
  light: boolean,
) {
  const themeKey = effect === "none" || effect === "dither" ? false : light;
  const cacheKey = `${sourceKey}:${effect}:${themeKey}`;
  let prepared = effectCache.get(cacheKey);
  if (!prepared) {
    prepared = (async () => {
      if (await ensureWorkerCapable()) {
        await ensureSource(sourceKey, src);
        const result = await request({
          kind: "render",
          sourceKey,
          effect,
          light: themeKey,
        });
        if (!result)
          throw new Error("The background effect returned no image.");
        return result;
      }
      const bytes = await fetchSourceBytes(src);
      return renderOnMainThread(bytes, effect, themeKey);
    })();
    effectCache.set(cacheKey, prepared);
    pruneByRevision(effectCache);
    forgetOnReject(effectCache, cacheKey);
  }
  return prepared;
}

export function clearPreparedNewThreadBackground() {
  appliedRevision += 1;
  if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
  activeObjectUrl = null;
  document.documentElement.style.removeProperty("--chat-background-image");
  document.documentElement.classList.remove("chat-background-effect-ready");
}

export async function applyPreparedNewThreadBackground(
  sourceKey: string,
  src: string,
  effect: NewThreadBackgroundEffect,
  light: boolean,
) {
  const revision = ++appliedRevision;
  const root = document.documentElement;
  root.classList.remove("chat-background-effect-ready");
  let blob: Blob;
  try {
    blob = await prepareNewThreadBackgroundEffect(
      sourceKey,
      src,
      effect,
      light,
    );
  } catch {
    if (revision !== appliedRevision) return;
    root.style.setProperty(
      "--chat-background-image",
      `url(${JSON.stringify(src)})`,
    );
    root.classList.add("chat-background-effect-ready");
    return;
  }
  if (revision !== appliedRevision) return;
  const objectUrl = URL.createObjectURL(blob);
  if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
  activeObjectUrl = objectUrl;
  root.style.setProperty(
    "--chat-background-image",
    `url(${JSON.stringify(objectUrl)})`,
  );
  requestAnimationFrame(() => {
    if (revision === appliedRevision) {
      root.classList.add("chat-background-effect-ready");
    }
  });
}
