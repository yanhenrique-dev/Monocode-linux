import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  readBinaryFile: vi.fn(),
  statFiles: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: (...args: unknown[]) => mocks.open(...args),
}));

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset://localhost/${path}`,
}));

vi.mock("./fs", () => ({
  readBinaryFile: (...args: unknown[]) => mocks.readBinaryFile(...args),
  statFiles: (...args: unknown[]) => mocks.statFiles(...args),
  slash: (path: string) => path.replace(/\\/g, "/"),
}));

type StartedSource = { buffer: AudioBuffer | null };

/**
 * Installs fake Audio/AudioContext globals. Sources started through the
 * context land in `started`; element playback (the fallback) lands in
 * `elements`. `decodeError` makes the context fail to decode, which forces
 * the fallback path; `playError` makes the fallback itself fail.
 */
function installAudio(options?: {
  decodeError?: unknown;
  playError?: unknown;
}) {
  const started: StartedSource[] = [];
  const elements: { src: string; volume: number }[] = [];

  class FakeContext {
    state = "running";
    destination = {};
    resume = vi.fn().mockResolvedValue(undefined);
    decodeAudioData = vi.fn(() =>
      options?.decodeError
        ? Promise.reject(options.decodeError)
        : Promise.resolve({ duration: 0.2 } as unknown as AudioBuffer),
    );
    createGain() {
      return {
        gain: { value: 0 },
        connect: vi.fn(() => ({ connect: vi.fn() })),
      };
    }
    createBufferSource(): StartedSource & {
      connect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
    } {
      const source: StartedSource & {
        connect: ReturnType<typeof vi.fn>;
        start: ReturnType<typeof vi.fn>;
      } = {
        buffer: null,
        connect: vi.fn(() => ({ connect: vi.fn() })),
        start: vi.fn(() => {
          if (source.buffer) started.push({ buffer: source.buffer });
        }),
      };
      return source;
    }
  }

  class FakeAudio {
    volume = 1;
    play = options?.playError
      ? vi.fn().mockRejectedValue(options.playError)
      : vi.fn().mockResolvedValue(undefined);
    constructor(src: string) {
      elements.push({ src, volume: this.volume });
    }
  }

  Object.defineProperty(globalThis, "AudioContext", {
    value: FakeContext,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, "Audio", {
    value: FakeAudio,
    configurable: true,
    writable: true,
  });
  return { started, elements };
}

import {
  clearSoundFileCache,
  clearSoundFileError,
  pickSoundFile,
  playSoundFile,
  resetAudioContext,
  setSoundFileVolume,
  soundFileError,
} from "./soundFiles";

const SOUND_PATH = "/home/user/Music/ding.ogg";

describe("soundFiles", () => {
  beforeEach(() => {
    mocks.open.mockReset();
    mocks.readBinaryFile.mockReset();
    mocks.statFiles.mockReset();
    mocks.statFiles.mockResolvedValue([{ path: SOUND_PATH, mtimeMs: 100 }]);
    clearSoundFileCache();
    clearSoundFileError(SOUND_PATH);
    setSoundFileVolume(0.55);
    resetAudioContext();
    installAudio();
  });

  describe("pickSoundFile", () => {
    it("returns the selected path", async () => {
      mocks.open.mockResolvedValue(SOUND_PATH);
      await expect(pickSoundFile()).resolves.toBe(SOUND_PATH);
      expect(mocks.open).toHaveBeenCalledWith(
        expect.objectContaining({
          multiple: false,
          directory: false,
        }),
      );
    });

    it("returns null when the dialog is cancelled", async () => {
      mocks.open.mockResolvedValue(null);
      await expect(pickSoundFile()).resolves.toBeNull();
    });
  });

  describe("playSoundFile", () => {
    it("decodes and plays through the audio context", async () => {
      const { started, elements } = installAudio();
      mocks.readBinaryFile.mockResolvedValue(new Uint8Array([1, 2, 3]));
      const result = await playSoundFile(SOUND_PATH);
      expect(result).toEqual({ ok: true });
      expect(started).toHaveLength(1);
      expect(elements).toHaveLength(0);
      expect(soundFileError(SOUND_PATH)).toBeNull();
    });

    it("caches the decoded buffer across plays with the same mtime", async () => {
      const { started } = installAudio();
      mocks.readBinaryFile.mockResolvedValue(new Uint8Array([1]));
      await playSoundFile(SOUND_PATH);
      await playSoundFile(SOUND_PATH);
      expect(mocks.readBinaryFile).toHaveBeenCalledTimes(1);
      expect(started).toHaveLength(2);
    });

    it("re-decodes when the file mtime changes", async () => {
      installAudio();
      mocks.readBinaryFile.mockResolvedValue(new Uint8Array([1]));
      await playSoundFile(SOUND_PATH);
      mocks.statFiles.mockResolvedValue([{ path: SOUND_PATH, mtimeMs: 200 }]);
      await playSoundFile(SOUND_PATH);
      expect(mocks.readBinaryFile).toHaveBeenCalledTimes(2);
    });

    it("falls back to the audio element when decoding fails", async () => {
      const { started, elements } = installAudio({ decodeError: "nope" });
      mocks.readBinaryFile.mockResolvedValue(new Uint8Array([1]));
      const result = await playSoundFile(SOUND_PATH);
      expect(result).toEqual({ ok: true });
      expect(started).toHaveLength(0);
      expect(elements).toHaveLength(1);
      expect(elements[0]?.src).toContain(SOUND_PATH);
      expect(soundFileError(SOUND_PATH)).toBeNull();
    });

    it("reports a missing file", async () => {
      installAudio();
      mocks.readBinaryFile.mockRejectedValue(
        new Error("No such file or directory (os error 2)"),
      );
      const result = await playSoundFile(SOUND_PATH);
      expect(result).toEqual({ ok: false, reason: "missing" });
      expect(soundFileError(SOUND_PATH)).toEqual({
        ok: false,
        reason: "missing",
      });
    });

    it("reports decode failure when both paths fail", async () => {
      installAudio({ decodeError: "cannot decode", playError: "unsupported" });
      mocks.readBinaryFile.mockResolvedValue(new Uint8Array([1]));
      const result = await playSoundFile(SOUND_PATH);
      expect(result).toEqual({ ok: false, reason: "decode" });
    });
  });
});
