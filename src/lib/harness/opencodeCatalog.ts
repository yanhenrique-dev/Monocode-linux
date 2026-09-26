import { homeDir } from "../fs";
import {
  setHarnessModels,
  type AgentModel,
  type ModelSetting,
  type ModelSettingChoice,
} from "../models";
import { execChild, resolveOpenCodeBinary } from "./child";
import {
  assertSupportedOpenCodeRelease,
  inferDefaultAgent,
  inferDefaultVariant,
  KNOWN_HIDDEN_AGENTS,
  openCodeVariantLabel,
  sortOpenCodeVariants,
  titleCaseSlug,
} from "./opencodeProtocol";
import { HARNESS_EXEC } from "./harnessContract";

const SLUG_LINE_RE = /^(\S+\/\S+)\s*$/;
const AGENT_HEADER_RE = /^(.+)\s+\((\S+)\)\s*$/;

type OpenCodeModelJson = {
  id?: string;
  /** V2 native name for `id`. */
  modelID?: string;
  name?: string;
  /** Only the V2 API carries this; the CLI prints `provider/model` slugs. */
  providerID?: string;
  /** V1 object map; V2 uses an array with an `id` (or `name`) per entry. */
  variants?: Record<string, unknown> | { id?: unknown; name?: unknown }[];
  /** V1 `"deprecated"` status / V2 `disabled` both mean skip. */
  status?: string;
  disabled?: boolean;
  /** V2 reports availability as `enabled`; false means not selectable. */
  enabled?: boolean;
  limit?: { context?: number; input?: number; output?: number };
};

/**
 * V2 consolidated two legacy provider namespaces; the migration guide
 * canonicalizes them, so normalize at parse time for both generations.
 */
export function canonicalOpenCodeProviderId(providerID: string): string {
  if (providerID === "azure-cognitive-services") return "azure";
  if (providerID === "google-vertex-anthropic") return "google-vertex";
  return providerID;
}

/** Normalizes one parsed model JSON across V1 and V2 native shapes. */
function normalizeOpenCodeModelJson(model: OpenCodeModelJson): void {
  if (!model.id && typeof model.modelID === "string") model.id = model.modelID;
  if (Array.isArray(model.variants)) {
    const record: Record<string, unknown> = {};
    for (const entry of model.variants) {
      if (!entry || typeof entry !== "object") continue;
      const key =
        typeof entry.id === "string"
          ? entry.id
          : typeof entry.name === "string"
            ? entry.name
            : undefined;
      if (key) record[key] = entry;
    }
    model.variants = record;
  }
}

function isDisabledOpenCodeModel(model: OpenCodeModelJson): boolean {
  return (
    model.disabled === true ||
    model.enabled === false ||
    model.status === "deprecated"
  );
}

type ParsedProvider = {
  id: string;
  name: string;
  models: Record<string, OpenCodeModelJson>;
};

const PROVIDER_NAMES: Record<string, string> = {
  opencode: "OpenCode",
  "opencode-go": "OpenCode Go",
  openai: "OpenAI",
  xai: "xAI",
  "github-copilot": "GitHub Copilot",
};

export type OpenCodeAgent = {
  name: string;
  mode: string;
  hidden: boolean;
};

let inflight: Promise<void> | null = null;

export function refreshOpenCodeCatalog(): Promise<void> {
  if (inflight) return inflight;
  inflight = discoverOpenCodeModels()
    .then((models) => {
      if (models.length > 0) setHarnessModels("opencode", models);
    })
    .catch((error: unknown) => {
      console.debug("[monocode] opencode catalog", error);
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

async function discoverOpenCodeModels(): Promise<AgentModel[]> {
  const { path } = await resolveOpenCodeBinary();
  const cwd = await homeDir();
  const versionOut = await execChild(path, HARNESS_EXEC.version, cwd);
  // Throws for undeterminable output and old V1; V2 passes on protocol.
  const { protocol } = assertSupportedOpenCodeRelease(versionOut);

  // V2 dropped the `models` and `agent list` subcommands, so the inventory
  // comes from the server API instead. Going through `opencode api` keeps the
  // CLI's own service discovery and authentication, which a spawned server
  // would otherwise make this code responsible for.
  if (protocol === "v2") {
    return discoverOpenCodeModelsV2(path, cwd);
  }

  const modelsOut = await execChild(
    path,
    HARNESS_EXEC.modelsVerbose,
    cwd,
  ).catch(() => "");
  let parsed =
    modelsOut.trim() && !looksLikePlainSlugList(modelsOut)
      ? parseModelsCliOutput(modelsOut)
      : { providers: new Map(), connected: [] as string[] };
  if (parsed.connected.length === 0) {
    const plainOut = looksLikePlainSlugList(modelsOut)
      ? modelsOut
      : await execChild(path, HARNESS_EXEC.models, cwd).catch(() => "");
    if (plainOut.trim()) parsed = parseModelsCliOutput(plainOut);
  }
  let agents: OpenCodeAgent[] = [];
  try {
    const agentsOut = await execChild(path, HARNESS_EXEC.agentList, cwd);
    agents = parseAgentListCliOutput(agentsOut);
  } catch (error) {
    console.debug("[monocode] opencode agents", error);
  }
  const models = flattenOpenCodeModels(parsed, agents);
  if (import.meta.env.DEV) {
    // The thinking-level control only exists for models with variants; when
    // this logs zero variants the provider simply advertises none (not a bug
    // in the picker). Distinguishes that from a verbose-parse failure, which
    // falls back to the plain slug list and drops every model's variants.
    console.debug(
      `[monocode] opencode catalog: ${models.length} models, ` +
        `${models.filter((model) => model.settings?.some((setting) => setting.id === "variant")).length} with variants ` +
        `(verbose ${modelsOut.trim() ? "ok" : "empty"})`,
    );
  }
  return models;
}

async function discoverOpenCodeModelsV2(
  path: string,
  cwd: string,
): Promise<AgentModel[]> {
  const modelsOut = await execChild(path, HARNESS_EXEC.apiGetModel, cwd).catch(
    () => "",
  );
  const parsed = parseV2ModelApiOutput(modelsOut);
  let agents: OpenCodeAgent[] = [];
  try {
    const agentsOut = await execChild(
      path,
      HARNESS_EXEC.apiGetAgent,
      cwd,
    );
    agents = parseV2AgentApiOutput(agentsOut);
  } catch (error) {
    console.debug("[monocode] opencode v2 agents", error);
  }
  if (import.meta.env.DEV) {
    console.debug(
      `[monocode] opencode v2 catalog: ${[...parsed.providers.values()].reduce(
        (total, provider) => total + Object.keys(provider.models).length,
        0,
      )} models, ${agents.length} agents`,
    );
  }
  return flattenOpenCodeModels(parsed, agents);
}

/**
 * `GET /api/model` returns `{ location, data: Model.Info[] }`. Each entry is a
 * native V2 model, so it feeds the same normalizer as the verbose CLI output.
 * The query is deliberately unscoped: asking for a project location can return
 * an empty list, and a catalog is provider-level anyway.
 */
export function parseV2ModelApiOutput(stdout: string): {
  providers: Map<string, ParsedProvider>;
  connected: string[];
} {
  const providers = new Map<string, ParsedProvider>();
  const data = apiDataArray(stdout);
  for (const item of data) {
    const model = asModelJson(item);
    if (!model) continue;
    normalizeOpenCodeModelJson(model);
    if (isDisabledOpenCodeModel(model)) continue;
    const providerID = canonicalOpenCodeProviderId(
      typeof model.providerID === "string" ? model.providerID : "",
    );
    const modelID =
      (typeof model.id === "string" ? model.id : "") ||
      (typeof model.modelID === "string" ? model.modelID : "");
    // V2 reports availability as `enabled`; a false one is not selectable.
    if (!providerID || !modelID) continue;
    if (item && typeof item === "object" && (item as { enabled?: unknown }).enabled === false) {
      continue;
    }
    let provider = providers.get(providerID);
    if (!provider) {
      provider = {
        id: providerID,
        name: openCodeProviderName(providerID),
        models: {},
      };
      providers.set(providerID, provider);
    }
    provider.models[modelID] = model;
  }
  return { providers, connected: [...providers.keys()] };
}

/**
 * `GET /api/agent` returns `{ location, data: Agent.Info[] }`. The id is what
 * the server accepts on the session routes; the display name is not a valid
 * substitute (V2 rejects it), so the id is what MonoCode sends.
 */
export function parseV2AgentApiOutput(stdout: string): OpenCodeAgent[] {
  return apiDataArray(stdout).flatMap((item) => {
    const rec = asRecord(item);
    const id = typeof rec?.id === "string" ? rec.id : "";
    if (!id) return [];
    const name = typeof rec?.name === "string" ? rec.name : id;
    const mode = typeof rec?.mode === "string" ? rec.mode : "all";
    const hidden =
      rec?.hidden === true || KNOWN_HIDDEN_AGENTS.has(id) || KNOWN_HIDDEN_AGENTS.has(name);
    return [{ name: id, mode, hidden }];
  });
}

function apiDataArray(stdout: string): unknown[] {
  const trimmed = stdout.trim();
  if (!trimmed) return [];
  // The CLI may print a progress line before the JSON body.
  const start = trimmed.indexOf("{");
  if (start < 0) return [];
  try {
    const parsed = asRecord(JSON.parse(trimmed.slice(start)));
    const data = parsed?.data;
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asModelJson(value: unknown): OpenCodeModelJson | null {
  const rec = asRecord(value);
  if (!rec) return null;
  return rec as OpenCodeModelJson;
}

export function parseModelsCliOutput(stdout: string): {
  providers: Map<string, ParsedProvider>;
  connected: string[];
} {
  const trimmed = stdout.trim();
  if (trimmed) {
    const plain = parsePlainModelSlugs(trimmed);
    if (plain) return plain;
  }
  return parseVerboseModelsCliOutput(stdout);
}

/**
 * `opencode models` (no flags) prints one `provider/model` slug per line.
 * Newer CLIs dropped `--json`, so accept the plain list as a catalog source
 * with names derived from the slug. Verbose metadata still wins when present.
 */
export function parsePlainModelSlugs(stdout: string): {
  providers: Map<string, ParsedProvider>;
  connected: string[];
} | null {
  const providers = new Map<string, ParsedProvider>();
  let slugs = 0;
  for (const raw of stdout.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("{")) return null;
    const separator = line.indexOf("/");
    if (separator <= 0 || separator === line.length - 1 || /\s/.test(line)) {
      return null;
    }
    const providerID = line.slice(0, separator);
    const modelID = line.slice(separator + 1);
    let provider = providers.get(providerID);
    if (!provider) {
      provider = {
        id: providerID,
        name: openCodeProviderName(providerID),
        models: {},
      };
      providers.set(providerID, provider);
    }
    if (!provider.models[modelID]) {
      provider.models[modelID] = { id: modelID };
      slugs += 1;
    }
  }
  if (slugs === 0) return null;
  const canonical = new Map<string, ParsedProvider>();
  for (const provider of providers.values()) {
    const id = canonicalOpenCodeProviderId(provider.id);
    const existing = canonical.get(id);
    if (!existing) {
      canonical.set(id, { ...provider, id });
      continue;
    }
    Object.assign(existing.models, provider.models);
  }
  return { providers: canonical, connected: [...canonical.keys()] };
}

function parseVerboseModelsCliOutput(stdout: string): {
  providers: Map<string, ParsedProvider>;
  connected: string[];
} {
  const providers = new Map<string, ParsedProvider>();
  const lines = stdout.split("\n");
  let currentSlug: string | null = null;
  const jsonLines: string[] = [];

  const flushModel = () => {
    if (currentSlug === null || jsonLines.length === 0) {
      currentSlug = null;
      jsonLines.length = 0;
      return;
    }
    const jsonStr = jsonLines.join("\n").trim();
    if (jsonStr.length > 0) {
      try {
        const model = JSON.parse(jsonStr) as OpenCodeModelJson;
        normalizeOpenCodeModelJson(model);
        if (isDisabledOpenCodeModel(model)) return;
        const separator = currentSlug.indexOf("/");
        if (separator > 0) {
          const providerID = canonicalOpenCodeProviderId(
            currentSlug.slice(0, separator),
          );
          const modelID = currentSlug.slice(separator + 1);
          let provider = providers.get(providerID);
          if (!provider) {
            provider = {
              id: providerID,
              name: openCodeProviderName(providerID),
              models: {},
            };
            providers.set(providerID, provider);
          }
          provider.models[modelID] = model;
        }
      } catch {
        // Skip unparseable model JSON
      }
    }
    currentSlug = null;
    jsonLines.length = 0;
  };

  for (const line of lines) {
    // Match slug lines on the trimmed text: some CLI generations indent the
    // inventory, and an indented slug must still start a new model — otherwise
    // the whole verbose output parses to zero models and the caller falls back
    // to the plain slug list, silently dropping every model's variants (and
    // with them the thinking-level control).
    const trimmed = line.trim();
    const slugMatch =
      trimmed.startsWith("{") || trimmed === ""
        ? null
        : SLUG_LINE_RE.exec(trimmed);
    if (slugMatch) {
      flushModel();
      currentSlug = slugMatch[1]!;
    } else if (currentSlug !== null) {
      jsonLines.push(line);
    }
  }
  flushModel();
  return { providers, connected: [...providers.keys()] };
}

export function parseAgentListCliOutput(stdout: string): OpenCodeAgent[] {
  const agents: OpenCodeAgent[] = [];
  const lines = stdout.split("\n");
  let currentHeader: { name: string; mode: string } | null = null;
  const blockLines: string[] = [];

  const flushAgent = () => {
    if (currentHeader === null) {
      currentHeader = null;
      blockLines.length = 0;
      return;
    }
    agents.push({
      name: currentHeader.name,
      mode: currentHeader.mode,
      hidden: KNOWN_HIDDEN_AGENTS.has(currentHeader.name),
    });
    currentHeader = null;
    blockLines.length = 0;
  };

  for (const line of lines) {
    const match = AGENT_HEADER_RE.exec(line);
    if (match) {
      flushAgent();
      currentHeader = { name: match[1]!, mode: match[2]! };
    } else if (currentHeader !== null) {
      blockLines.push(line);
    }
  }
  flushAgent();
  return agents;
}

export function flattenOpenCodeModels(
  parsed: { providers: Map<string, ParsedProvider>; connected: string[] },
  agents: OpenCodeAgent[],
): AgentModel[] {
  const connected = new Set(parsed.connected);
  const primaryAgents = agents.filter(
    (agent) =>
      !agent.hidden && (agent.mode === "primary" || agent.mode === "all"),
  );
  const models: AgentModel[] = [];
  for (const provider of parsed.providers.values()) {
    if (!connected.has(provider.id)) continue;
    for (const [modelId, model] of Object.entries(provider.models)) {
      const name = model.name?.trim() || titleCaseSlug(modelId);
      // `nativeId` is what gets sent back to the server, so it must echo the
      // provider id the server itself reported. The bucket key is the
      // canonical display id, which is not always what the API accepts; the
      // CLI path carries no `providerID` and keeps the bucket as before.
      const wireProviderId = model.providerID?.trim() || provider.id;
      const nativeId = `${wireProviderId}/${model.id ?? modelId}`;
      const contextWindow = model.limit?.context;
      models.push({
        id: `opencode:${nativeId}`,
        harness: "opencode",
        name,
        nativeId,
        provider: { id: provider.id, name: provider.name },
        settings: openCodeModelSettings(provider.id, model, primaryAgents),
        ...(contextWindow && contextWindow > 0 ? { contextWindow } : {}),
      });
    }
  }
  return models.sort((left, right) => left.name.localeCompare(right.name));
}

export function openCodeProviderName(providerID: string): string {
  return PROVIDER_NAMES[providerID] ?? titleCaseSlug(providerID);
}

/** True when stdout is the plain `provider/model` list, not verbose JSON. */
function looksLikePlainSlugList(stdout: string): boolean {
  const lines = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return false;
  return lines.every((line) => {
    if (line.startsWith("{") || /\s/.test(line)) return false;
    const separator = line.indexOf("/");
    return separator > 0 && separator < line.length - 1;
  });
}

function openCodeModelSettings(
  providerID: string,
  model: OpenCodeModelJson,
  agents: OpenCodeAgent[],
): ModelSetting[] | undefined {
  const settings: ModelSetting[] = [];
  const variantValues = sortOpenCodeVariants(Object.keys(model.variants ?? {}));
  if (variantValues.length > 0) {
    const defaultVariant = inferDefaultVariant(providerID, variantValues);
    const options: ModelSettingChoice[] = variantValues.map((value) => ({
      value,
      label: openCodeVariantLabel(value),
    }));
    settings.push({
      id: "variant",
      label: "Variant",
      kind: "select",
      value: defaultVariant ?? options[0].value,
      options,
    });
  }
  if (agents.length > 0) {
    const defaultAgent = inferDefaultAgent(agents);
    settings.push({
      id: "agent",
      label: "Agent",
      kind: "select",
      value: defaultAgent ?? agents[0].name,
      options: agents.map((agent) => ({
        value: agent.name,
        label: titleCaseSlug(agent.name),
      })),
    });
  }
  return settings.length > 0 ? settings : undefined;
}
