/**
 * The consumer half of the Rust <-> TypeScript boundary contract.
 *
 * The same file `src-tauri/src/contract.rs` compiles in is imported here, so
 * there is one list rather than two that happen to agree. Nothing in this
 * module is policy: the backend enforces, and it enforces what
 * `contracts/rust-ipc.json` says. What lives here is the set of argument
 * vectors this app is allowed to ask for, named so a call site reads as intent
 * rather than as a literal.
 *
 * The invariant is one-directional and asymmetric on purpose:
 *
 *   every vector declared here must appear in the contract
 *
 * The contract may list more than this app sends -- a vector can be permitted
 * for a harness this build does not use. That direction is allowed, because the
 * backend is the authority on what is safe to run, not on what is currently
 * called.
 *
 * See `docs/CONTRACTS.md` for the change protocol.
 */
import contract from "../../../contracts/rust-ipc.json";

/** The permitted argument vectors for `harness_exec`, keyed by intent. */
export const HARNESS_EXEC = {
  /** Every harness reports its own version this way. */
  version: ["--version"],
  /** Cursor enumerates models with a flag rather than a subcommand. */
  listModels: ["--list-models"],
  /** V1's verbose catalog, the only form that names each provider's ids. */
  modelsVerbose: ["models", "--verbose"],
  /** fx prints its catalog as JSON, which is the only form it parses. */
  modelsJson: ["models", "--json"],
  /** The bare subcommand form, used where the human-readable list suffices. */
  models: ["models"],
  /** fx's auth state, needed to tell "no key" from "no output". */
  statusJson: ["status", "--json"],
  /** V1 agent enumeration. */
  agentList: ["agent", "list"],
  /**
   * V2 dropped both subcommands above, so its catalog comes from the server
   * API. The `api` subcommand does the service discovery and auth on the CLI
   * side, which is why it is preferred over standing up a server this app would
   * have to spawn and authenticate to itself.
   */
  apiGetModel: ["api", "get", "/api/model"],
  apiGetAgent: ["api", "get", "/api/agent"],
} as const satisfies Record<string, readonly string[]>;

export type HarnessExecIntent = keyof typeof HARNESS_EXEC;

/** The vectors the contract permits, as the backend sees them. */
export const ALLOWED_EXEC_ARGS: readonly string[][] = contract.boundaries.harness_exec.allowed_args;

/** Whether the contract permits this exact vector. Length- and order-sensitive. */
export function isAllowedExecArgs(args: readonly string[]): boolean {
  return ALLOWED_EXEC_ARGS.some((allowed) => allowed.length === args.length && allowed.every((arg, i) => arg === args[i]));
}

/** The intents this app declares, for iteration in tests and diagnostics. */
export const DECLARED_EXEC_INTENTS = Object.keys(HARNESS_EXEC) as HarnessExecIntent[];

/** V2's `serve` credential, as the contract states it. */
export const SERVE_PASSWORD = {
  scheme: contract.boundaries.serve_password.scheme,
  user: contract.boundaries.serve_password.user,
} as const;
