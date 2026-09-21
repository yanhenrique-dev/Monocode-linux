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
  openCodeBasicAuth,
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

  it("sends the per-process server password as Basic auth", async () => {
    const client = createOpenCodeClient("http://127.0.0.1:4096", "/repo", "v2", {
      password: "secret-123",
    });

    await client.getSession("session_1");

    expect(mocks.harnessHttp).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: openCodeBasicAuth("secret-123"),
        }),
      }),
    );
    expect(openCodeBasicAuth("secret-123")).toBe(
      `Basic ${Buffer.from("opencode:secret-123", "utf8").toString("base64")}`,
    );
  });

  it("omits auth when the server printed no password (V1)", async () => {
    const client = createOpenCodeClient("http://127.0.0.1:4096", "/repo", "v1");

    await client.getSession("session_1");

    const headers = mocks.harnessHttp.mock.calls[0][0].headers;
    expect(headers.Authorization).toBeUndefined();
  });
});

describe("OpenCodeClientV2", () => {
  it("admits prompts durably with an idempotency id", async () => {
    const client = new OpenCodeClientV2("http://127.0.0.1:4096", "/repo");

    await client.promptAsync({
      sessionID: "session/a",
      model: { providerID: "openai", modelID: "gpt-5.4" },
      parts: [{ type: "text", text: "hi" }],
    });

    expect(mocks.harnessHttp).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "http://127.0.0.1:4096/api/session/session%2Fa/prompt?directory=%2Frepo",
        method: "POST",
      }),
    );
    const body = JSON.parse(mocks.harnessHttp.mock.calls[0][0].body);
    expect(body).toMatchObject({
      model: { providerID: "openai", modelID: "gpt-5.4" },
      parts: [{ type: "text", text: "hi" }],
      resume: true,
    });
    expect(typeof body.id).toBe("string");
    expect(body.id.length).toBeGreaterThan(0);
  });

  it("replies to permissions under the session route", async () => {
    const client = new OpenCodeClientV2("http://127.0.0.1:4096", "/repo");

    await client.replyPermission("session/a", "req-1", "once");

    expect(mocks.harnessHttp).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "http://127.0.0.1:4096/api/session/session%2Fa/permission/req-1/reply?directory=%2Frepo",
        method: "POST",
      }),
    );
  });

  it("replies to questions under the session route", async () => {
    const client = new OpenCodeClientV2("http://127.0.0.1:4096", "/repo");

    await client.replyQuestion("session/a", "req-1", [["yes"]]);

    expect(mocks.harnessHttp).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "http://127.0.0.1:4096/api/session/session%2Fa/question/request/req-1/reply?directory=%2Frepo",
        method: "POST",
      }),
    );
  });

  it("deletes a session through the V2 route", async () => {
    const client = new OpenCodeClientV2("http://127.0.0.1:4096", "/repo");

    await client.deleteSession("session/a");

    expect(mocks.harnessHttp).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "http://127.0.0.1:4096/api/session/session%2Fa?directory=%2Frepo",
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
