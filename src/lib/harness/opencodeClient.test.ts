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
  it("admits prompts with a msg_-prefixed id, plain text, and no model", async () => {
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
    expect(body.id).toMatch(/^msg_/);
    expect(body).toMatchObject({ text: "hi", resume: true });
    expect(body).not.toHaveProperty("model");
    expect(body).not.toHaveProperty("parts");
  });

  it("sends file parts as V2 file refs", async () => {
    const client = new OpenCodeClientV2("http://127.0.0.1:4096", "/repo");

    await client.promptAsync({
      sessionID: "session/a",
      model: { providerID: "openai", modelID: "gpt-5.4" },
      parts: [
        { type: "text", text: "review" },
        {
          type: "file",
          mime: "text/plain",
          filename: "a.ts",
          url: "file:///repo/a.ts",
        },
      ],
    });

    const body = JSON.parse(mocks.harnessHttp.mock.calls[0][0].body);
    expect(body).toMatchObject({
      text: "review",
      files: [{ uri: "file:///repo/a.ts", name: "a.ts" }],
    });
  });

  it("binds model and agent on the session", async () => {
    const client = new OpenCodeClientV2("http://127.0.0.1:4096", "/repo");

    await client.setModel?.("session/a", {
      providerID: "openai",
      modelID: "gpt-5.4",
    });
    await client.setAgent?.("session/a", "build");

    expect(mocks.harnessHttp).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "http://127.0.0.1:4096/api/session/session%2Fa/model?directory=%2Frepo",
        method: "POST",
      }),
    );
    expect(JSON.parse(mocks.harnessHttp.mock.calls[0][0].body)).toEqual({
      model: { id: "gpt-5.4", providerID: "openai" },
    });
    expect(mocks.harnessHttp).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "http://127.0.0.1:4096/api/session/session%2Fa/agent?directory=%2Frepo",
        method: "POST",
      }),
    );
  });

  it("creates sessions with the permissions ruleset key", async () => {
    const client = new OpenCodeClientV2("http://127.0.0.1:4096", "/repo");

    await client.createSession({
      permission: [{ action: "*", resource: "*", effect: "allow" }],
    });

    const body = JSON.parse(mocks.harnessHttp.mock.calls[0][0].body);
    expect(body.permissions).toEqual([
      { action: "*", resource: "*", effect: "allow" },
    ]);
    expect(body).not.toHaveProperty("permission");
  });

  it("cancels turns via interrupt and compacts via compact", async () => {
    const client = new OpenCodeClientV2("http://127.0.0.1:4096", "/repo");

    await client.abortSession("session/a");
    await client.summarizeSession("session/a", {
      providerID: "openai",
      modelID: "gpt-5.4",
    });

    expect(mocks.harnessHttp).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "http://127.0.0.1:4096/api/session/session%2Fa/interrupt?directory=%2Frepo",
        method: "POST",
      }),
    );
    expect(mocks.harnessHttp).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "http://127.0.0.1:4096/api/session/session%2Fa/compact?directory=%2Frepo",
        method: "POST",
      }),
    );
  });

  it("replies to permissions with the decision field", async () => {
    const client = new OpenCodeClientV2("http://127.0.0.1:4096", "/repo");

    await client.replyPermission("session/a", "req-1", "once");

    expect(mocks.harnessHttp).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "http://127.0.0.1:4096/api/session/session%2Fa/permission/req-1/reply?directory=%2Frepo",
        method: "POST",
      }),
    );
    expect(JSON.parse(mocks.harnessHttp.mock.calls[0][0].body)).toEqual({
      decision: "once",
    });
  });

  it("fails loudly on V2 question and rewind routes without equivalents", async () => {
    const client = new OpenCodeClientV2("http://127.0.0.1:4096", "/repo");

    await expect(client.replyQuestion("session/a", "req-1", [["yes"]])).rejects.toThrow(
      /not supported on OpenCode V2/,
    );
    await expect(client.rejectQuestion("session/a", "req-1")).rejects.toThrow(
      /not supported on OpenCode V2/,
    );
    await expect(client.revertSession("session/a", "msg_1")).rejects.toThrow(
      /not supported on OpenCode V2/,
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
