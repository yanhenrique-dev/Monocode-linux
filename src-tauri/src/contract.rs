//! The provider half of the Rust <-> TypeScript boundary contract.
//!
//! The allowlist below is not written here. It is read from
//! `contracts/rust-ipc.json`, which the frontend also imports, so there is
//! exactly one list and both sides are checked against it. `include_str!`
//! compiles the file into the binary, which is the right direction for a
//! policy the provider must enforce: changing the contract requires
//! rebuilding the provider, and a running binary cannot disagree with the
//! artifact it was built from.
//!
//! See `docs/CONTRACTS.md` for the change protocol.

use std::sync::OnceLock;

/// Relative to this file: `src-tauri/src/` -> repo root.
const ARTIFACT: &str = include_str!("../../contracts/rust-ipc.json");

/// The parsed contract. Parsed once: `exec_args_allowed` runs on every harness
/// invocation, and a JSON parse per call would show up in spawn latency.
fn artifact() -> &'static Value {
    static PARSED: OnceLock<Value> = OnceLock::new();
    PARSED.get_or_init(|| {
        serde_json::from_str(ARTIFACT)
            .expect("contracts/rust-ipc.json is compiled into the binary and must parse")
    })
}

use serde_json::Value;

/// The permitted argument vectors for `harness_exec`, as declared by the
/// contract. Kept as `Vec<String>` per entry because that is what the call site
/// has, and comparing borrowed text against owned text is what the old
/// `&[&[&str]]` constant forced into a second, hand-written copy.
fn allowed_args() -> &'static Vec<Vec<String>> {
    static ALLOWED: OnceLock<Vec<Vec<String>>> = OnceLock::new();
    ALLOWED.get_or_init(|| {
        let boundaries = &artifact()["boundaries"];
        let list = boundaries["harness_exec"]["allowed_args"]
            .as_array()
            .expect("harness_exec.allowed_args must be an array");
        list.iter()
            .map(|entry| {
                entry
                    .as_array()
                    .expect("each allowed_args entry must be an array of strings")
                    .iter()
                    .map(|arg| {
                        arg.as_str()
                            .expect("each argument must be a string")
                            .to_owned()
                    })
                    .collect()
            })
            .collect()
    })
}

/// Whether `args` is a vector the contract permits.
///
/// Exact match on length and on every element: a prefix, a reordered vector, or
/// a superset is not permitted. The contract states this, and the frontend test
/// asserts the same rule from its side, so a change in meaning has to be made in
/// the artifact and in both checkers together.
pub(crate) fn exec_args_allowed(args: &[String]) -> bool {
    allowed_args().iter().any(|allowed| allowed == args)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(v: &[&str]) -> Vec<String> {
        v.iter().map(|s| (*s).to_owned()).collect()
    }

    /// The old checker asserted the list against itself: it proved the tuples
    /// already in the constant were still there, and could not notice a
    /// frontend that invented a new one. This asserts the shape of the
    /// artifact itself, which is the thing both sides now read.
    #[test]
    fn artifact_parses_and_declares_the_exec_allowlist() {
        let list = allowed_args();
        assert!(!list.is_empty(), "allowed_args must not be empty");
        for entry in list {
            assert!(
                !entry.is_empty(),
                "an empty vector permits nothing and is a mistake"
            );
        }
    }

    /// A duplicate entry is a copy-paste error, and because the matcher is
    /// length-and-element exact it would be invisible at runtime: the second
    /// copy simply never matches. It is checked here so the artifact stays
    /// clean. Note that a vector *may* be a prefix of another -- `models` and
    /// `models --verbose` both belong -- because the length check keeps them
    /// distinct.
    #[test]
    fn no_vector_is_declared_twice() {
        let list = allowed_args();
        for (i, a) in list.iter().enumerate() {
            for b in &list[i + 1..] {
                assert_ne!(a, b, "{a:?} is declared twice");
            }
        }
    }

    /// The provider's own risk is the artifact being edited into something
    /// permissive, so the cases here are all about refusal. The matching rule
    /// itself is asserted from the consumer side too, in
    /// `src/lib/harness/harnessContract.test.ts`, because that is the side
    /// whose vectors can drift away from this list.
    #[test]
    fn refuses_anything_the_contract_does_not_declare() {
        assert!(!exec_args_allowed(&args(&[])));
        // A prefix of a permitted vector is not itself permitted.
        assert!(!exec_args_allowed(&args(&["api"])));
        assert!(!exec_args_allowed(&args(&["api", "get"])));
        // A write verb is off the list by design, not by oversight.
        assert!(!exec_args_allowed(&args(&["api", "post", "/api/model"])));
        // Reordering is not the same vector.
        assert!(!exec_args_allowed(&args(&["--json", "models"])));
        // A superset is not permitted either.
        assert!(!exec_args_allowed(&args(&[
            "models",
            "--json",
            "--verbose"
        ])));
    }

    /// Guards the fields the other three boundaries are stated in terms of, so
    /// a rename in the artifact cannot silently detach it from the code that
    /// implements it.
    #[test]
    fn the_other_boundaries_declare_what_their_consumers_depend_on() {
        let b = &artifact()["boundaries"];
        assert!(b["harness_sse_open"]["frame"]["name"].is_string());
        assert!(b["harness_sse_open"]["frame"]["data"].is_string());
        assert!(b["serve_password"]["scheme"] == "Basic");
        assert!(b["serve_password"]["user"] == "opencode");
        assert!(b["default_cwd"]["guarantee"].is_string());
        for name in [
            "harness_exec",
            "harness_sse_open",
            "default_cwd",
            "serve_password",
        ] {
            assert!(
                b[name]["guarantee"].is_string(),
                "{name} must state a guarantee in prose; that prose is the part \
                 a future reader needs and a test cannot check"
            );
        }
    }
}
