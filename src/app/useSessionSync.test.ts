import { describe, expect, it } from "vitest";
import {
  beginHistoryRequest,
  isCurrentHistoryRequest,
} from "./useSessionSync";

describe("history request generation", () => {
  it("rejects an older response after a project is revisited", () => {
    const requests = new Map<string, number>();
    const firstA = beginHistoryRequest(requests, "/repo/a");
    beginHistoryRequest(requests, "/repo/b");
    const secondA = beginHistoryRequest(requests, "/repo/a");

    expect(
      isCurrentHistoryRequest(requests, "/repo/a", firstA, "/repo/a", "/repo/a"),
    ).toBe(false);
    expect(
      isCurrentHistoryRequest(requests, "/repo/a", secondA, "/repo/a", "/repo/a"),
    ).toBe(true);
  });

  it("rejects a response for a project that is no longer active", () => {
    const requests = new Map<string, number>();
    const request = beginHistoryRequest(requests, "/repo/a");

    expect(
      isCurrentHistoryRequest(requests, "/repo/a", request, "/repo/a", "/repo/b"),
    ).toBe(false);
  });
});
