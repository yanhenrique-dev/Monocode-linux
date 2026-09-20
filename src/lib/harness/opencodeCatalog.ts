import { homeDir } from "../fs";
import {
  setHarnessModels,
  type AgentModel,
  type ModelSetting,
  type ModelSettingChoice,
} from "../models";
import { execChild, resolveOpenCodeBinary } from "./child";
import {
  compareSemver,
  inferDefaultAgent,
  inferDefaultVariant,
  KNOWN_HIDDEN_AGENTS,
  MINIMUM_OPENCODE_VERSION,
  openCodeVariantLabel,
  parseOpenCodeVersion,
  sortOpenCodeVariants,
  titleCaseSlug,
} from "./opencodeProtocol";

const SLUG_LINE_RE = /^(\S+\/\S+)\s*$/;
const AGENT_HEADER_RE = /^(.+)\s+\((\S+)\)\s*$/;

type OpenCodeModelJson = {
  id?: string;
  name?: string;
  variants?: Record<string, unknown>;
  limit?: { context?: number; input?: number; output?: number };
};

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
  const versionOut = await execChild(path, ["--version"], cwd);
  const version = parseOpenCodeVersion(versionOut);
  if (!version) {
    throw new Error(
      `Unable to determine OpenCode version. MonoCode requires v${MINIMUM_OPENCODE_VERSION} or newer.`,
    );
  }
  if (compareSemver(version, MINIMUM_OPENCODE_VERSION) < 0) {
    throw new Error(
      `OpenCode v${version} is too old. Upgrade to v${MINIMUM_OPENCODE_VERSION} or newer.`,
    );
  }

  const modelsOut = await execChild(
    path,
    ["models", "--verbose"],
    cwd,
  ).catch(() => "");
  let parsed =
    modelsOut.trim() && !looksLikePlainSlugList(modelsOut)
      ? parseModelsCliOutput(modelsOut)
      : { providers: new Map(), connected: [] as string[] };
  if (parsed.connected.length === 0) {
    const plainOut = looksLikePlainSlugList(modelsOut)
      ? modelsOut
      : await execChild(path, ["models"], cwd).catch(() => "");
    if (plainOut.trim()) parsed = parseModelsCliOutput(plainOut);
  }
  let agents: OpenCodeAgent[] = [];
  try {
    const agentsOut = await execChild(path, ["agent", "list"], cwd);
    agents = parseAgentListCliOutput(agentsOut);
  } catch (error) {
    console.debug("[monocode] opencode agents", error);
  }
  return flattenOpenCodeModels(parsed, agents);
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
  return { providers, connected: [...providers.keys()] };
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
        const separator = currentSlug.indexOf("/");
        if (separator > 0) {
          const providerID = currentSlug.slice(0, separator);
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
    const slugMatch = line.trimStart().startsWith("{")
      ? null
      : SLUG_LINE_RE.exec(line);
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
      const nativeId = `${provider.id}/${model.id ?? modelId}`;
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
