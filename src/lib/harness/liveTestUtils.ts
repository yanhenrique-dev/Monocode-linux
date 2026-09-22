import type { HarnessEvent } from "./types";

/**
 * Shared scaffold for `*Live.test.ts` harnesses.
 *
 * Every live test mocks `./child` with a `sent` log and an `onLine`
 * delivery callback, then reimplements `parse` / `reply` / `notify` /
 * `waitFor` by hand. `createLiveWire` owns that mutable pair once; each
 * suite keeps its own wire so tests stay independent.
 */
export type LiveWire = {
  /** Raw JSON-RPC lines written to the fake child. */
  sent: string[];
  /** Clear the log and disconnect (call in `beforeEach`). */
  reset: () => void;
  /** Called by the mocked `watchChild` to receive child output. */
  connect: (line: (l: string) => void) => void;
  /** Feed one line back from the fake child. */
  deliver: (line: string) => void;
  /** Parse every sent line as a JSON object. */
  parse: () => Record<string, unknown>[];
  /** Reply to a pending request id. */
  reply: (id: number, result: unknown) => void;
  /** Push a notification from the fake child. */
  notify: (method: string, params: unknown) => void;
  /** Poll `pred` until true; throws with the sent method trail on timeout. */
  waitFor: (pred: () => boolean, label: string) => Promise<void>;
};

export function createLiveWire(): LiveWire {
  const sent: string[] = [];
  let onLine: ((line: string) => void) | undefined;
  const parse = (): Record<string, unknown>[] =>
    sent.map((line) => JSON.parse(line) as Record<string, unknown>);
  const deliver = (line: string): void => {
    if (!onLine) throw new Error("live wire is not connected");
    onLine(line);
  };
  return {
    sent,
    reset: () => {
      sent.length = 0;
      onLine = undefined;
    },
    connect: (line) => {
      onLine = line;
    },
    deliver,
    parse,
    reply: (id, result) => deliver(JSON.stringify({ id, result })),
    notify: (method, params) => deliver(JSON.stringify({ method, params })),
    waitFor: async (pred, label) => {
      for (let i = 0; i < 200; i++) {
        if (pred()) return;
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      throw new Error(
        `timed out waiting for ${label}; sent=${JSON.stringify(parse().map((m) => m.method ?? `reply:${m.id}`))}`,
      );
    },
  };
}

/** Drop `turn.started` so assertions compare steady-state events only. */
export function withoutTurnIdentity(events: HarnessEvent[]): HarnessEvent[] {
  return events.filter((event) => event.type !== "turn.started");
}
