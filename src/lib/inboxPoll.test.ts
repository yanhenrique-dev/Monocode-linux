import { describe, expect, it } from "vitest";
import {
  inboxBackoffMs,
  INBOX_MAX_POLL_BACKOFF_MS,
  INBOX_POLL_MS,
  isInboxRateLimitMessage,
  mergeInboxSnapshots,
} from "./inboxPoll";
import type { GithubWorkItem } from "./githubTasks";

function workItem(updatedAt: string): GithubWorkItem {
  return {
    provider: "github",
    kind: "issue",
    repo: "org/repo",
    number: 1,
    title: "t",
    updatedAt,
  } as GithubWorkItem;
}

describe("isInboxRateLimitMessage", () => {
  it("shouldDetectRateLimitWording", () => {
    expect(isInboxRateLimitMessage("API rate limit exceeded")).toBe(true);
  });

  it("shouldDetectQuotaWording", () => {
    expect(isInboxRateLimitMessage("quota exceeded for Sas")).toBe(true);
  });

  it("shouldRejectUnrelatedErrors", () => {
    expect(isInboxRateLimitMessage("network unreachable")).toBe(false);
  });
});

describe("inboxBackoffMs", () => {
  it("shouldGrowExponentiallyFromPollCadence", () => {
    expect(inboxBackoffMs(1)).toBe(INBOX_POLL_MS * 2);
  });

  it("shouldCapAtMaxBackoff", () => {
    expect(inboxBackoffMs(99)).toBe(INBOX_MAX_POLL_BACKOFF_MS);
  });
});

describe("mergeInboxSnapshots", () => {
  it("shouldKeepSameReferenceWhenNothingChanged", () => {
    const current = new Map([["a", workItem("2026-01-01T00:00:00Z")]]);
    expect(
      mergeInboxSnapshots(current, [["a", workItem("2026-01-01T00:00:00Z")]]),
    ).toBe(current);
  });

  it("shouldReplaceChangedEntries", () => {
    const current = new Map([["a", workItem("2026-01-01T00:00:00Z")]]);
    const next = mergeInboxSnapshots(current, [
      ["a", workItem("2026-02-01T00:00:00Z")],
    ]);
    expect(next.get("a")?.updatedAt).toBe("2026-02-01T00:00:00Z");
  });
});
