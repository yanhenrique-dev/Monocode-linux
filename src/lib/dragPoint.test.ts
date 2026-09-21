import { describe, expect, it } from "vitest";
import { dragPointToClient } from "./dragPoint";

describe("dragPointToClient", () => {
  it("keeps GTK logical points as is at any scale", () => {
    expect(dragPointToClient(1000, 500)).toEqual({ x: 1000, y: 500 });
  });
});
