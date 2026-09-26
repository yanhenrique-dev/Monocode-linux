# Contracts

Boundaries in this app where two pieces of code have to agree about a shape,
and where neither side is allowed to keep its own copy.

## The one that matters: Rust <-> TypeScript

`contracts/rust-ipc.json` is the canonical artifact. It is version-controlled,
it lives outside `src/` and outside `src-tauri/` because it belongs to neither
side, and both sides read it:

| Side | How it reads the artifact | Checker |
| --- | --- | --- |
| Provider (Rust, `src-tauri`) | `include_str!` in `src-tauri/src/contract.rs`, compiled into the binary | `cargo test --lib contract` |
| Consumer (TypeScript, `src`) | `import` in `src/lib/harness/harnessContract.ts` | `harnessContract.test.ts` |

Compiling the artifact into the provider is deliberate. A running binary cannot
disagree with the artifact it was built from, and changing the contract requires
rebuilding the backend — which is the correct friction for a policy that decides
what may be executed.

### Why this exists

Four defects shipped from this boundary in one release cycle. Every one was a
disagreement between the two sides, not a logic error in either language:

| Defect | Producer | Consumer | How it was missed |
| --- | --- | --- | --- |
| SSE `event:` field dropped | Rust framed the event | TS read the type from it | no test spanned the frame |
| `api get /api/model` refused | Rust enforced the allowlist | TS authored the call | the Rust test asserted its own list against itself |
| V2 `serve` password never sent | Rust extracted it from the process | TS put it in the header | the credential was never written down |
| Install directory offered as a project | Rust returned the process cwd | TS assumed "project" | the value had no stated meaning |

The backend's old test, `allows_known_catalog_args`, listed the tuples the Rust
side already knew about. It proved the list matched itself. It could not notice
a frontend that invented a new vector, which is exactly what happened.

### Declared boundaries

- **`harness_exec`** — the permitted argument vectors, and the exact
  length-and-order matching rule. The contract may list more than the app sends;
  the app may not send anything the contract omits.
- **`harness_sse_open`** — the `(name, data)` frame pair. `name` is the SSE
  `event:` field verbatim or null, and it is not decoration: V2 carries the event
  discriminator there.
- **`default_cwd`** — a starting-directory suggestion, explicitly *not* a chosen
  project. The provider refuses to return the app's install directory; the
  consumer's obligation not to persist what it gets is what makes that guard
  load-bearing.
- **`serve_password`** — the Basic auth scheme and username V2 requires on every
  route, including read-only catalog calls.

Each entry states its guarantee in prose as well as in data. A future reader needs
the sentence; a test cannot check it.

## Changing a boundary

Never change the implementation first and the artifact second.

1. Change `contracts/rust-ipc.json`.
2. Run `cargo test --lib contract` and `harnessContract.test.ts`. Both will fail
   until the code follows.
3. Update the provider and the consumer.
4. Re-run `npm run check` and `cargo test`.

An **additive** change — a new permitted vector, a new optional field — is
compatible: existing consumers keep working. A **breaking** change needs a
migration, not a silent repurposing of an existing field. Widening
`allowed_args` to a write verb, or to a route outside loopback, is a security
change and not an additive one: the comment in the artifact says why the two
`api get` entries are the only API routes permitted.

## Adding a boundary

Only worth it where the two sides build or deploy independently and a shape has
actually drifted. For a boundary that changes in one commit with no independent
consumer, a plain shared type is enough — contract machinery would be overhead.

## Not covered here

The harness adapters duplicate a small field-extraction kit across eight
`*Protocol.ts` files: `asRecord` nine times, `stringField` eight, `numberField`
six, `textFromContent` five, plus `usageFromUpdate`, `toolKindFromName`,
`sumNumbers` and `sessionIdFromResult` three to four times each. That is
duplication rather than a contract problem, so no artifact is warranted — it
wants one shared kit that all eight import. It is also why fixing one parsing bug
has meant editing eight files, which is how the V2 migration turned into six
pull requests.

The V2 event catalog is a different kind of boundary: the authority is upstream's
published schema, and `src/lib/harness/opencodeV2.ts` is the derived consumer
type. The remainder of that catalog beyond the events listed in
`contracts/rust-ipc.json` is read from the `v2` branch source rather than
guessed, but two areas are still inferred and unexercised against a running
server: the event carrying a pending form, and replay after resume.
