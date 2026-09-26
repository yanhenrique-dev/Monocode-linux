import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  harnessHttp: vi.fn(),
}));

vi.mock("./child", () => ({
  closeHarnessSse: vi.fn(),
  harnessHttp: mocks.harnessHttp,
  openHarnessSse: vi.fn(),
  watchSse: vi.fn(),
}));

import {
  createOpenCodeClient,
  OpenCodeClientV1,
  OpenCodeClientV2,
} from "./opencodeClient";

beforeEach(() => {
  mocks.harnessHttp.mockReset();
  mocks.harnessHttp.mockResolvedValue({ status: 200, body: "true" });
});

describe("OpenCodeClientV1.summarizeSession", () => {
  it("calls the native session summarize endpoint with the selected model", async () => {
    const client = new OpenCodeClientV1("http://127.0.0.1:4096", "/repo");

    await client.summarizeSession("session/a", {
      providerID: "openai",
      modelID: "gpt-5.4",
    });

    expect(mocks.harnessHttp).toHaveBeenCalledWith({
      url: "http://127.0.0.1:4096/session/session%2Fa/summarize?directory=%2Frepo",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-opencode-directory": "%2Frepo",
      },
      body: JSON.stringify({ providerID: "openai", modelID: "gpt-5.4" }),
      timeoutMs: 30 * 60_000,
    });
  });

  it("deletes a session through the V1 route", async () => {
    const client = new OpenCodeClientV1("http://127.0.0.1:4096", "/repo");

    await client.deleteSession("session/a");

    expect(mocks.harnessHttp).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "http://127.0.0.1:4096/session/session%2Fa?directory=%2Frepo",
        method: "DELETE",
      }),
    );
  });
});

describe("createOpenCodeClient", () => {
  it("selects the transport by protocol", () => {
    expect(
      createOpenCodeClient("http://127.0.0.1:4096", "/repo", "v1"),
    ).toBeInstanceOf(OpenCodeClientV1);
    expect(
      createOpenCodeClient("http://127.0.0.1:4096", "/repo", "v2"),
    ).toBeInstanceOf(OpenCodeClientV2);
  });
});

/** V2 scopes by a JSON `location` object, not V1's `directory` parameter. */
const V2_LOCATION = "?location=%7B%22directory%22%3A%22%2Frepo%22%7D";
const v2Url = (path: string) => `http://127.0.0.1:4096/api${path}${V2_LOCATION}`;

function callAt(index: number) {
  return mocks.harnessHttp.mock.calls.at(index)![0] as {
    url: string;
    method: string;
    body?: string;
    headers?: Record<string, string>;
  };
}
const lastCall = () => callAt(mocks.harnessHttp.mock.calls.length - 1);

describe("OpenCodeClientV2", () => {
  it("switches the session model before admitting a prompt", async () => {
    const client = new OpenCodeClientV2("http://127.0.0.1:4096", "/repo");

    await client.promptAsync({
      sessionID: "session/a",
      model: { providerID: "openai", modelID: "gpt-5.4" },
      variant: "high",
      parts: [{ type: "text", text: "hi" }],
    });

    // V2 takes no model on the prompt body, so it moves to its own route.
    const model = callAt(0);
    expect(model.url).toBe(v2Url("/session/session%2Fa/model"));
    // Model.Ref spells the model `id`, not V1's `modelID`.
    expect(JSON.parse(model.body!)).toEqual({
      model: { id: "gpt-5.4", providerID: "openai", variant: "high" },
    });
  });

  it("admits prompts durably with an idempotency id", async () => {
    const client = new OpenCodeClientV2("http://127.0.0.1:4096", "/repo");

    await client.promptAsync({
      sessionID: "session/a",
      model: { providerID: "openai", modelID: "gpt-5.4" },
      parts: [
        { type: "text", text: "hi" },
        {
          type: "file",
          mime: "text/plain",
          filename: "a.txt",
          url: "file:///a.txt",
        },
      ],
    });

    const prompt = lastCall();
    expect(prompt.url).toBe(v2Url("/session/session%2Fa/prompt"));
    expect(prompt.method).toBe("POST");
    const body = JSON.parse(prompt.body!);
    // V2 replaced `parts` with a required `text` plus typed attachment arrays.
    expect(body).toMatchObject({
      text: "hi",
      files: [{ uri: "file:///a.txt", name: "a.txt" }],
      resume: true,
      delivery: "steer",
    });
    expect(body.model).toBeUndefined();
    expect(body.parts).toBeUndefined();
    // V2 constrains the admission id to `^msg_`.
    expect(body.id).toMatch(/^msg_/);
  });

  it("switches the agent only when it changes", async () => {
    const client = new OpenCodeClientV2("http://127.0.0.1:4096", "/repo");
    const model = { providerID: "openai", modelID: "gpt-5.4" };

    await client.promptAsync({
      sessionID: "session/a",
      model,
      agent: "build",
      parts: [{ type: "text", text: "one" }],
    });
    expect(callAt(0).url).toBe(v2Url("/session/session%2Fa/agent"));
    expect(JSON.parse(callAt(0).body!)).toEqual({ agent: "build" });
    const afterFirst = mocks.harnessHttp.mock.calls.length;

    await client.promptAsync({
      sessionID: "session/a",
      model,
      agent: "build",
      parts: [{ type: "text", text: "two" }],
    });

    // Second turn reuses the session's agent and model, so only the prompt runs.
    expect(mocks.harnessHttp.mock.calls.length).toBe(afterFirst + 1);
    expect(lastCall().url).toBe(v2Url("/session/session%2Fa/prompt"));
  });

  it("re-applies the model after the agent changes", async () => {
    const client = new OpenCodeClientV2("http://127.0.0.1:4096", "/repo");
    const model = { providerID: "openai", modelID: "gpt-5.4" };

    await client.promptAsync({
      sessionID: "session/a",
      model,
      agent: "build",
      parts: [{ type: "text", text: "one" }],
    });
    const before = mocks.harnessHttp.mock.calls.length;

    await client.promptAsync({
      sessionID: "session/a",
      model,
      agent: "plan",
      parts: [{ type: "text", text: "two" }],
    });

    // The new agent can impose its own model, so the caller's choice is
    // re-applied even though the model key is unchanged.
    const urls = mocks.harnessHttp.mock.calls
      .slice(before)
      .map((call) => (call[0] as { url: string }).url);
    expect(urls).toEqual([
      v2Url("/session/session%2Fa/agent"),
      v2Url("/session/session%2Fa/model"),
      v2Url("/session/session%2Fa/prompt"),
    ]);
  });

  it("compacts through the V2 route with the session model", async () => {
    const client = new OpenCodeClientV2("http://127.0.0.1:4096", "/repo");

    await client.summarizeSession("session/a", {
      providerID: "openai",
      modelID: "gpt-5.4",
    });

    expect(callAt(0).url).toBe(v2Url("/session/session%2Fa/model"));
    expect(lastCall().url).toBe(v2Url("/session/session%2Fa/compact"));
  });

  it("interrupts instead of aborting", async () => {
    const client = new OpenCodeClientV2("http://127.0.0.1:4096", "/repo");

    await client.abortSession("session/a");

    expect(lastCall().url).toBe(v2Url("/session/session%2Fa/interrupt"));
  });

  it("stages and commits a revert", async () => {
    const client = new OpenCodeClientV2("http://127.0.0.1:4096", "/repo");

    await client.revertSession("session/a", "msg_1");

    expect(callAt(0).url).toBe(v2Url("/session/session%2Fa/revert/stage"));
    expect(JSON.parse(callAt(0).body!)).toEqual({ messageID: "msg_1" });
    expect(lastCall().url).toBe(v2Url("/session/session%2Fa/revert/commit"));
  });

  it("replies to permissions with a decision field", async () => {
    const client = new OpenCodeClientV2("http://127.0.0.1:4096", "/repo");

    await client.replyPermission("session/a", "req-1", "once");

    const call = lastCall();
    expect(call.url).toBe(v2Url("/session/session%2Fa/permission/req-1/reply"));
    // V2 named the field `decision`; V1's `reply` is rejected.
    expect(JSON.parse(call.body!)).toEqual({ decision: "once" });
  });

  it("answers a pending form as a keyed answer", async () => {
    const client = new OpenCodeClientV2("http://127.0.0.1:4096", "/repo");

    await client.replyQuestion({
      sessionID: "session/a",
      requestID: "frm_1",
      questions: [
        {
          id: "mode",
          prompt: "Mode",
          multiSelect: false,
          allowCustom: false,
          options: [],
        },
        {
          id: "tags",
          prompt: "Tags",
          multiSelect: true,
          allowCustom: false,
          options: [
            { id: "a", label: "A" },
            { id: "b", label: "B" },
          ],
        },
      ],
      reply: {
        kind: "answered",
        answers: { mode: ["fast"], tags: ["a", "b"] },
      },
    });

    const call = lastCall();
    // V2 dropped the question routes; structured input is a Form.
    expect(call.url).toBe(v2Url("/session/session%2Fa/form/frm_1/reply"));
    expect(JSON.parse(call.body!)).toEqual({
      answer: { mode: "fast", tags: ["a", "b"] },
    });
  });

  it("cancels a pending form by deleting it", async () => {
    const client = new OpenCodeClientV2("http://127.0.0.1:4096", "/repo");

    await client.rejectQuestion("session/a", "frm_1");

    const call = lastCall();
    expect(call.url).toBe(v2Url("/session/session%2Fa/form/frm_1"));
    expect(call.method).toBe("DELETE");
  });

  it("sends the V2 serve password as Basic auth on every request", async () => {
    // Without these credentials V2 answers 401 on every route.
    const client = new OpenCodeClientV2(
      "http://127.0.0.1:4096",
      "/repo",
      "s3cret",
    );

    await client.getSession("ses_1");

    const call = callAt(0);
    expect(call.headers?.Authorization).toBe(
      `Basic ${btoa("opencode:s3cret")}`,
    );
  });

  it("omits the auth header when no password was captured", async () => {
    const client = new OpenCodeClientV2("http://127.0.0.1:4096", "/repo");

    await client.getSession("ses_1");

    expect(callAt(0).headers?.Authorization).toBeUndefined();
  });

  it("surfaces a session's V2 location as its directory", async () => {
    const client = new OpenCodeClientV2("http://127.0.0.1:4096", "/repo");
    mocks.harnessHttp.mockResolvedValue({
      status: 200,
      body: JSON.stringify({ id: "ses_1", location: { directory: "/other" } }),
    });

    // The resume path compares this against the current project to decide
    // between adopting a session and forking it into this directory.
    const session = await client.getSession("ses_1");
    expect(session.directory).toBe("/other");
  });

  it("deletes a session through the V2 route", async () => {
    const client = new OpenCodeClientV2("http://127.0.0.1:4096", "/repo");

    await client.deleteSession("session/a");

    expect(mocks.harnessHttp).toHaveBeenCalledWith(
      expect.objectContaining({
        url: v2Url("/session/session%2Fa"),
        method: "DELETE",
      }),
    );
  });

  it("reads V2 _tag error envelopes", async () => {
    const client = new OpenCodeClientV2("http://127.0.0.1:4096", "/repo");
    mocks.harnessHttp.mockResolvedValue({
      status: 404,
      body: JSON.stringify({
        _tag: "SessionNotFoundError",
        message: "no such session",
      }),
    });

    const error = await client.getSession("missing").catch((err) => err);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("NotFoundError");
    expect(String(error.message)).toContain("SessionNotFoundError");
  });
});
