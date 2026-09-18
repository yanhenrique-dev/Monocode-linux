import { describe, expect, it, vi } from "vitest";
import {
  clipboardImageTypes,
  filesFromClipboard,
  mergeAttachments,
  needsAsyncImageRead,
  readClipboardImageFile,
} from "./attachments";
import type { Attachment } from "./session";

function file(name: string, type: string, body = "x") {
  return new File([body], name, { type });
}

function item(next: File): {
  kind: string;
  type: string;
  getAsFile: () => File | null;
} {
  return {
    kind: "file",
    type: next.type,
    getAsFile: () => next,
  };
}

function attachment(
  partial: Partial<Attachment> & Pick<Attachment, "id" | "name">,
): Attachment {
  return {
    mimeType: "image/png",
    kind: "image",
    size: 4,
    ...partial,
  };
}

describe("mergeAttachments", () => {
  it("keeps previously attached images when adding more", () => {
    const first = attachment({ id: "a", name: "one.png" });
    const second = attachment({ id: "b", name: "two.png" });
    expect(mergeAttachments([first], [second]).map((file) => file.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("skips the same path twice", () => {
    const first = attachment({
      id: "a",
      name: "shot.png",
      path: "/tmp/shot.png",
    });
    const again = attachment({
      id: "b",
      name: "shot.png",
      path: "/tmp/shot.png",
    });
    expect(mergeAttachments([first], [again])).toEqual([first]);
  });
});

describe("filesFromClipboard", () => {
  it("returns every file item when the files list is truncated", () => {
    const a = file("a.png", "image/png", "a");
    const b = file("b.png", "image/png", "b");
    expect(
      filesFromClipboard({
        files: [a],
        items: [item(a), item(b)],
      }),
    ).toEqual([a, b]);
  });

  it("drops the unnamed tiff twin of a png screenshot", () => {
    const png = file("image.png", "image/png");
    const tiff = file("image.tiff", "image/tiff");
    expect(
      filesFromClipboard({
        files: [png],
        items: [item(png), item(tiff)],
      }),
    ).toEqual([png]);
  });

  it("keeps a real named tiff next to a png", () => {
    const png = file("diagram.png", "image/png");
    const tiff = file("scan.tiff", "image/tiff");
    expect(
      filesFromClipboard({
        files: [png, tiff],
        items: [item(png), item(tiff)],
      }),
    ).toEqual([png, tiff]);
  });
});

describe("clipboardImageTypes", () => {
  it("finds image types while ignoring text", () => {
    expect(
      clipboardImageTypes(["text/plain", "text/html", "image/png"]),
    ).toEqual(["image/png"]);
  });

  it("returns empty for missing or text-only types", () => {
    expect(clipboardImageTypes(null)).toEqual([]);
    expect(clipboardImageTypes(undefined)).toEqual([]);
    expect(clipboardImageTypes(["text/plain", "Files"])).toEqual([]);
  });
});

describe("needsAsyncImageRead", () => {
  it("reads when the transfer advertises an image", () => {
    expect(needsAsyncImageRead(["text/plain", "image/png"], "")).toBe(true);
  });

  it("reads when the webview hid types and no text is present", () => {
    expect(needsAsyncImageRead(null, "")).toBe(true);
    expect(needsAsyncImageRead(undefined, "")).toBe(true);
    expect(needsAsyncImageRead([], "")).toBe(true);
  });

  it("leaves plain-text pastes to default insertion", () => {
    expect(needsAsyncImageRead(["text/plain"], "hello")).toBe(false);
    expect(needsAsyncImageRead(null, "hello")).toBe(false);
    expect(needsAsyncImageRead([], "hello")).toBe(false);
  });

  it("stays silent for known non-image transfers without text", () => {
    expect(needsAsyncImageRead(["text/html"], "")).toBe(false);
  });
});

describe("readClipboardImageFile", () => {
  it("converts the first clipboard image item into a File", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const blob = new Blob([bytes], { type: "image/png" });
    const read = vi.fn(async () => [
      {
        types: ["text/plain", "image/png"],
        getType: async (type: string) => {
          expect(type).toBe("image/png");
          return blob;
        },
      },
    ]);
    const result = await readClipboardImageFile({ read });
    expect(read).toHaveBeenCalledOnce();
    expect(result).toBeInstanceOf(File);
    expect(result?.type).toBe("image/png");
    expect(result?.size).toBe(3);
  });

  it("returns null when no provider, no items, or no image type", async () => {
    expect(await readClipboardImageFile(null)).toBeNull();
    expect(await readClipboardImageFile({})).toBeNull();
    expect(
      await readClipboardImageFile({
        read: async () => [
          {
            types: ["text/plain"],
            getType: async () => new Blob(["x"], { type: "text/plain" }),
          },
        ],
      }),
    ).toBeNull();
  });

  it("returns null when the clipboard read rejects", async () => {
    const read = vi.fn(async () => {
      throw new DOMException("denied", "NotAllowedError");
    });
    expect(await readClipboardImageFile({ read })).toBeNull();
  });
});
