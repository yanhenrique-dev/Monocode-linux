import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { readBinaryFile, statFiles } from "./fs";

/**
 * User-chosen audio for notification cues. The cuelume engine only synthesizes
 * its own recipes, so custom sounds play through Web Audio here, with an
 * `<audio>` fallback for codecs the webview's GStreamer stack cannot decode.
 */

export const SOUND_FILE_FILTERS = [
  {
    name: "Audio",
    extensions: ["ogg", "oga", "wav", "mp3", "flac", "m4a", "opus"],
  },
];

const SOUND_PICK_TITLE = "Choose notification sound";

export async function pickSoundFile(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    title: SOUND_PICK_TITLE,
    filters: SOUND_FILE_FILTERS,
  });
  return typeof selected === "string" && selected ? selected : null;
}

export type SoundFileReason = "missing" | "decode" | "unavailable";

export type SoundFileResult =
  | { ok: true }
  | { ok: false; reason: SoundFileReason };

/** Loudness parity with the cuelume engine; sounds.ts keeps this in sync. */
let volume = 0.55;

export function setSoundFileVolume(next: number) {
  volume = next;
}

type CacheEntry = { buffer: AudioBuffer | null; mtimeMs: number | null; reason?: SoundFileReason };
const decoded = new Map<string, CacheEntry>();
const lastErrors = new Map<string, SoundFileResult>();

/** Last failure for a path, so Settings can hint instead of failing silently. */
export function soundFileError(path: string): SoundFileResult | null {
  return lastErrors.get(path) ?? null;
}

export function clearSoundFileError(path: string) {
  lastErrors.delete(path);
}

export function clearSoundFileCache(path?: string) {
  if (path == null) decoded.clear();
  else decoded.delete(path);
}

let context: AudioContext | undefined;

/** Drop the cached AudioContext, e.g. when the engine or environment changes. */
export function resetAudioContext() {
  context = undefined;
}

function audioContext(): AudioContext | null {
  try {
    const Ctor =
      globalThis.AudioContext ??
      (globalThis as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    context ??= new Ctor();
    if (context.state === "suspended") void context.resume().catch(() => {});
    return context;
  } catch {
    return null;
  }
}

async function mtimeOf(path: string): Promise<number | null> {
  try {
    const [stat] = await statFiles([path]);
    return stat?.mtimeMs ?? null;
  } catch {
    return null;
  }
}

async function decodedBuffer(
  path: string,
): Promise<{ buffer: AudioBuffer | null; reason: SoundFileReason }> {
  const cached = decoded.get(path);
  const mtimeMs = await mtimeOf(path);
  if (cached && cached.mtimeMs === mtimeMs) {
    return { buffer: cached.buffer, reason: cached.reason ?? "decode" };
  }
  let buffer: AudioBuffer | null = null;
  let reason: SoundFileReason = "decode";
  try {
    const bytes = await readBinaryFile(path);
    const ctx = audioContext();
    if (!ctx) {
      reason = "unavailable";
    } else {
      buffer = await ctx.decodeAudioData(
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // The Rust command errors on absent files; decode errors mean the codec
    // stack could not parse a file that exists.
    reason = /no such file|not found/i.test(message) ? "missing" : "decode";
  }
  decoded.set(path, { buffer, mtimeMs, reason: buffer ? undefined : reason });
  if (buffer) lastErrors.delete(path);
  else lastErrors.set(path, { ok: false, reason });
  return { buffer, reason };
}

/** Play a custom sound once. Resolves false with a reason on failure. */
export async function playSoundFile(path: string): Promise<SoundFileResult> {
  let reason: SoundFileReason = "decode";
  try {
    const decoded = await decodedBuffer(path);
    reason = decoded.reason;
    // A missing file cannot be played by the fallback either: fail now.
    if (decoded.reason === "missing") {
      lastErrors.set(path, { ok: false, reason });
      return { ok: false, reason };
    }
    if (decoded.buffer) {
      const ctx = audioContext();
      if (ctx) {
        const source = ctx.createBufferSource();
        const gain = ctx.createGain();
        gain.gain.value = volume;
        source.buffer = decoded.buffer;
        source.connect(gain).connect(ctx.destination);
        source.start(0);
        return { ok: true };
      }
    }
    // Decode failed or Web Audio unavailable: the GStreamer fallback plays
    // whatever the webview's media stack supports even when the decoder
    // cannot.
    const ElementCtor = globalThis.Audio as
      | (new (src: string) => HTMLAudioElement)
      | undefined;
    if (!ElementCtor) return { ok: false, reason };
    const element = new ElementCtor(convertFileSrc(path));
    element.volume = volume;
    await element.play();
    clearSoundFileError(path);
    return { ok: true };
  } catch {
    lastErrors.set(path, { ok: false, reason });
    return { ok: false, reason };
  }
}
