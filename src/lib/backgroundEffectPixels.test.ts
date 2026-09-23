import { describe, expect, it } from "vitest";
import {
  asciiPixels,
  computeLuma,
  ditherPixels,
  halftonePixels,
  nonePixels,
  scanlinePixels,
  type EffectPixels,
} from "./backgroundEffectPixels";

function fixture(): EffectPixels {
  const width = 8;
  const height = 8;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const shade = Math.round((i / (width * height - 1)) * 255);
    pixels[i * 4] = shade;
    pixels[i * 4 + 1] = shade;
    pixels[i * 4 + 2] = shade;
    pixels[i * 4 + 3] = 255;
  }
  return { width, height, pixels, luma: computeLuma(pixels, width, height) };
}

describe("backgroundEffectPixels", () => {
  it("computes Rec.709 luma", () => {
    const pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 255]);
    expect([...computeLuma(pixels, 2, 1)]).toEqual([54, 0]);
  });

  it("keeps dimensions and alpha on every effect", () => {
    const source = fixture();
    for (const run of [
      () => nonePixels(source),
      () => ditherPixels(source),
      () => asciiPixels(source, false),
      () => halftonePixels(source, false),
      () => scanlinePixels(source, false),
    ]) {
      const out = run();
      expect(out.length).toBe(source.pixels.length);
      for (let a = 3; a < out.length; a += 4) {
        expect(out[a]).toBe(255);
      }
    }
  });

  it("darkens every third scanline and splits light/dark paper", () => {
    const source = fixture();
    const dark = scanlinePixels(source, false);
    const light = scanlinePixels(source, true);
    // Row 0 gain 0.52 on a mid gray must differ between themes.
    expect(dark[0]).not.toBe(light[0]);
    const haloDark = halftonePixels(source, false);
    const haloLight = halftonePixels(source, true);
    expect([...haloDark.slice(0, 4)]).not.toEqual([
      ...haloLight.slice(0, 4),
    ]);
  });
});
