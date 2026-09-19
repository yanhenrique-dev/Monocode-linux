import type { ApprovalDecision } from "./types";

export type McodePermissionRequest = {
  title: string;
  kind?: string;
  callId?: string;
  optionIds: string[];
};

type Record_ = Record<string, unknown>;

function asRecord(value: unknown): Record_ | null {
  return value && typeof value === "object" ? (value as Record_) : null;
}

/**
 * Read one of the named keys from the records in order. Records come
 * first and keys second: reading every key of the first record in
 * insertion order instead returns the wrong field for toolCallId/title/
 * kind, which once auto-allowed write-class tools in plan mode.
 */
function stringField(
  ...args: Array<Record_ | null | undefined | string>
): string | undefined {
  const records = args.filter(
    (arg): arg is Record_ => Boolean(arg) && typeof arg === "object",
  );
  const keys = args.filter((arg): arg is string => typeof arg === "string");
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && value.length > 0) return value;
    }
  }
  return undefined;
}

function pickOption(optionIds: string[], preferred: string[]): string | null {
  for (const candidate of preferred) {
    const hit = optionIds.find(
      (id) => id.toLowerCase() === candidate.toLowerCase(),
    );
    if (hit) return hit;
  }
  return null;
}

/**
 * Parse an ACP `session/request_permission` notification into the
 * shape the rest of the harness expects: title, optional tool kind,
 * call id, and the list of option ids the agent offered.
 */
export function mcodePermissionRequestFromAcp(
  params: unknown,
): McodePermissionRequest {
  const rec = asRecord(params) ?? {};
  const toolCall = asRecord(rec.toolCall) ?? asRecord(rec.tool_call);
  const callId =
    stringField(toolCall, rec, "toolCallId", "tool_call_id") ?? undefined;
  const kind = stringField(toolCall, rec, "kind") ?? undefined;
  const title =
    stringField(toolCall, rec, "title", "name") ?? "Tool call";
  const options = Array.isArray(rec.options) ? rec.options : [];
  const optionIds = options
    .map((option) => {
      const r = asRecord(option);
      return typeof r?.optionId === "string"
        ? (r.optionId as string)
        : typeof r?.id === "string"
          ? (r.id as string)
          : null;
    })
    .filter((value): value is string => Boolean(value));
  return { title, kind, callId, optionIds };
}

/**
 * Auto-approve any permission request that still reaches us.
 * Picks the most permissive option id from the option list.
 */
export function mcodeAutoPermissionOption(
  _runtimeMode: unknown,
  optionIds: string[],
): string | null {
  if (optionIds.length === 0) return null;
  return pickOption(optionIds, [
    "allow-always",
    "allow_always",
    "allow-once",
    "allow_once",
    "allow",
  ]);
}

/**
 * Map an ApprovalDecision to the matching option id mcode offered.
 * Falls back to `allow-once` / `reject-once` if the option list uses
 * a non-canonical label we don't recognize.
 */
export function mcodePermissionOptionId(
  decision: ApprovalDecision,
  optionIds: string[],
): string {
  if (decision === "allow") {
    return (
      pickOption(optionIds, [
        "allow-once",
        "allow_once",
        "allow-always",
        "allow_always",
        "allow",
      ]) ?? "allow-once"
    );
  }
  return (
    pickOption(optionIds, [
      "reject-once",
      "reject_once",
      "reject-always",
      "reject_always",
      "reject",
    ]) ?? "reject-once"
  );
}
