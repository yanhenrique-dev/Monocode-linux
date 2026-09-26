import { modelsFor } from "../models";
import {
  execChild,
  freeHarnessPort,
  killChild,
  resolveOpenCodeBinary,
  spawnChild,
  unwatchChild,
  watchChild,
} from "./child";
import { createOpenCodeClient, type OpenCodeClient } from "./opencodeClient";
import {
  assertSupportedOpenCodeRelease,
  parseOpenCodeModelSlug,
  parseServerUrlFromOutput,
  type OpenCodeProtocol,
} from "./opencodeProtocol";

const TEXT_CHILD_ID = "monocode-opencode-text";
const SERVER_TIMEOUT_MS = 30_000;
const REQUEST_TIMEOUT_MS = 45_000;

type LiveText = {
  client: OpenCodeClient;
  sessionId: string;
  cwd: string;
  model: { providerID: string; modelID: string };
};

let live: LiveText | null = null;
let turns: Promise<void> = Promise.resolve();
let serverUrl = "";

export async function stopOpenCodeTextPrompt(): Promise<void> {
  await dropLive();
}

export function warmupOpenCodeText(cwd: string): Promise<void> {
  if (!cwd || cwd === "~") return Promise.resolve();
  const run = turns.catch(() => undefined).then(async () => {
    await ensureLive(cwd);
  });
  turns = run.then(
    () => undefined,
    () => undefined,
  );
  return run.catch(() => undefined);
}

export async function runOpenCodeTextPrompt(input: {
  cwd: string;
  prompt: string;
  timeoutMs?: number;
}): Promise<string> {
  const run = turns.catch(() => undefined).then(() => promptOnLive(input));
  turns = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function promptOnLive(input: {
  cwd: string;
  prompt: string;
  timeoutMs?: number;
}): Promise<string> {
  const session = await ensureLive(input.cwd);
  try {
    const result = await session.client.prompt({
      sessionID: session.sessionId,
      model: session.model,
      parts: [{ type: "text", text: input.prompt }],
      timeoutMs: input.timeoutMs ?? REQUEST_TIMEOUT_MS,
    });
    const error = result.info?.error;
    if (error) {
      throw new Error(
        typeof error === "object" && error && "message" in error
          ? String((error as { message: unknown }).message)
          : "OpenCode text generation failed",
      );
    }
    const text = getOpenCodeTextResponse(result.parts);
    if (!text) throw new Error("OpenCode returned empty output.");
    return text;
  } finally {
    await dropLive();
  }
}

async function ensureLive(cwd: string): Promise<LiveText> {
  const model = pickTextModel();
  if (live && live.cwd === cwd && sameModel(live.model, model)) return live;
  if (live) await dropLive();
  return startLive(cwd, model);
}

async function startLive(
  cwd: string,
  model: { providerID: string; modelID: string },
): Promise<LiveText> {
  const { path } = await resolveOpenCodeBinary();
  const versionOut = await execChild(path, ["--version"], cwd).catch(() => "");
  let protocol: OpenCodeProtocol;
  try {
    ({ protocol } = assertSupportedOpenCodeRelease(versionOut));
  } catch {
    throw new Error(
      `OpenCode ${versionOut.trim() || "unknown"} is too old for text generation.`,
    );
  }

  serverUrl = "";
  watchChild(
    TEXT_CHILD_ID,
    (line) => {
      const parsed = parseServerUrlFromOutput(line);
      if (parsed) serverUrl = parsed;
    },
    () => {
      if (live) live = null;
    },
    (line) => {
      const parsed = parseServerUrlFromOutput(line);
      if (parsed) serverUrl = parsed;
    },
  );

  const port = await freeHarnessPort();
  await spawnChild(
    TEXT_CHILD_ID,
    path,
    ["serve", `--hostname=127.0.0.1`, `--port=${port}`],
    cwd,
  );

  try {
    const url = await waitForUrl(() => serverUrl, SERVER_TIMEOUT_MS);
    const client = createOpenCodeClient(url, cwd, protocol);
    const created = await client.createSession({
      // These sessions only synthesize text (titles, commits, PR bodies), so
      // every tool is denied. The rules must be built per protocol: the V1
      // shape is not a V2 rule, and V2 would fall through to its `allow`
      // default rather than deny.
      permission: client.denyAllPermissionRules(),
    });
    live = { client, sessionId: created.id, cwd, model };
    return live;
  } catch (error) {
    await dropLive();
    throw error;
  }
}

async function dropLive(): Promise<void> {
  const current = live;
  live = null;
  if (current) {
    await current.client.abortSession(current.sessionId);
    await current.client.closeEvents(TEXT_CHILD_ID);
  }
  unwatchChild(TEXT_CHILD_ID);
  await killChild(TEXT_CHILD_ID).catch(() => undefined);
}

function pickTextModel(): { providerID: string; modelID: string } {
  const models = modelsFor("opencode");
  for (const model of models) {
    const parsed = parseOpenCodeModelSlug(model.nativeId ?? model.id);
    if (parsed) return parsed;
  }
  throw new Error(
    "No OpenCode model available. Wait for the catalog to load, then pick a model.",
  );
}

function sameModel(
  left: { providerID: string; modelID: string },
  right: { providerID: string; modelID: string },
): boolean {
  return left.providerID === right.providerID && left.modelID === right.modelID;
}

export function getOpenCodeTextResponse(parts: unknown[] | undefined): string {
  return (parts ?? [])
    .flatMap((part) => {
      if (!part || typeof part !== "object") return [];
      if (!("type" in part) || part.type !== "text") return [];
      if (!("text" in part) || typeof part.text !== "string") return [];
      return [part.text];
    })
    .join("")
    .trim();
}

function waitForUrl(read: () => string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const url = read();
      if (url) {
        resolve(url);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        reject(new Error("Timed out waiting for OpenCode text server"));
        return;
      }
      setTimeout(tick, 50);
    };
    tick();
  });
}
