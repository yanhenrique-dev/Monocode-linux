use std::collections::{HashMap, HashSet};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::dirs_home;

#[derive(Serialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OmpInterjectionAnchor {
    pub(crate) id: String,
    pub(crate) after_assistant_text: String,
    pub(crate) after_occurrence: usize,
    pub(crate) after_assistant_text_concat: String,
    pub(crate) after_concat_occurrence: usize,
    /// A directly following text-only answer can have been coalesced into the
    /// parent block by old builds. Require both full texts before splitting it.
    pub(crate) following_assistant_text: Option<String>,
    pub(crate) following_assistant_text_concat: Option<String>,
    pub(crate) text: String,
    pub(crate) custom_type: String,
    pub(crate) severity: Option<String>,
}

/// One active-path assistant message in file order. Both join forms of its
/// text parts are alternatives for the same message, never two messages.
#[derive(Serialize, Debug, PartialEq, Eq)]
pub struct OmpAssistantText {
    pub(crate) text: String,
    pub(crate) concat: String,
}

/// Recover displayed OMP custom messages that older MonoCode builds omitted
/// from their persisted transcript. The provider id is already stored with the
/// session; matching the original JSONL keeps the repair deterministic instead
/// of guessing from neighbouring reasoning text.
#[tauri::command(async)]
pub fn omp_session_interjections(
    provider_session_id: String,
) -> Result<Vec<OmpInterjectionAnchor>, String> {
    let Some(path) = omp_session_path(&provider_session_id)? else {
        return Ok(Vec::new());
    };
    parse_omp_interjections(&path)
}

#[tauri::command(async)]
pub fn omp_active_assistant_texts(
    provider_session_id: String,
) -> Result<Vec<OmpAssistantText>, String> {
    let Some(path) = omp_session_path(&provider_session_id)? else {
        return Ok(Vec::new());
    };
    active_omp_assistant_texts(&path)
}

fn omp_session_path(provider_session_id: &str) -> Result<Option<PathBuf>, String> {
    if provider_session_id.is_empty()
        || !provider_session_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
    {
        return Err("Invalid OMP provider session id".into());
    }
    let root = dirs_home()
        .map(PathBuf::from)
        .ok_or("Home directory is unavailable")?
        .join(".omp/agent/sessions");
    Ok(find_omp_session_file(&root, provider_session_id))
}

fn find_omp_session_file(root: &Path, provider_session_id: &str) -> Option<PathBuf> {
    let suffix = format!("_{provider_session_id}.jsonl");
    let projects = std::fs::read_dir(root).ok()?;
    for project in projects.flatten() {
        let path = project.path();
        if path.is_file()
            && path
                .file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.ends_with(&suffix))
        {
            return Some(path);
        }
        if !path.is_dir() {
            continue;
        }
        let Ok(entries) = std::fs::read_dir(path) else {
            continue;
        };
        for entry in entries.flatten() {
            let candidate = entry.path();
            if candidate.is_file()
                && candidate
                    .file_name()
                    .and_then(|name| name.to_str())
                    .is_some_and(|name| name.ends_with(&suffix))
            {
                return Some(candidate);
            }
        }
    }
    None
}

fn omp_message_text(value: &serde_json::Value, separator: &str) -> String {
    if let Some(text) = value.as_str() {
        return text.to_owned();
    }
    value
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|part| {
            (part.get("type").and_then(serde_json::Value::as_str) == Some("text"))
                .then(|| part.get("text").and_then(serde_json::Value::as_str))
                .flatten()
        })
        .collect::<Vec<_>>()
        .join(separator)
}

fn read_omp_entries(path: &Path) -> Result<Vec<serde_json::Value>, String> {
    let file = std::fs::File::open(path).map_err(|error| format!("{}: {error}", path.display()))?;
    let mut entries = Vec::new();
    for line in BufReader::new(file).lines() {
        let Ok(line) = line else { continue };
        let Ok(value) = serde_json::from_str::<serde_json::Value>(&line) else {
            continue;
        };
        entries.push(value);
    }
    Ok(entries)
}

fn omp_active_ids(entries: &[serde_json::Value]) -> HashSet<&str> {
    let nodes: HashMap<_, _> = entries
        .iter()
        .filter_map(|value| value["id"].as_str().map(|id| (id, value)))
        .collect();
    let mut active = HashSet::new();
    let mut cursor = entries.last().and_then(|value| value["id"].as_str());
    while let Some(id) = cursor {
        if !active.insert(id) {
            break;
        }
        cursor = nodes.get(id).and_then(|value| value["parentId"].as_str());
    }
    active
}

// Return the ordered sequence, not per-text counts: a status split may only
// be merged with the message at its own source position.
pub(crate) fn active_omp_assistant_texts(path: &Path) -> Result<Vec<OmpAssistantText>, String> {
    let entries = read_omp_entries(path)?;
    let active = omp_active_ids(&entries);
    Ok(entries
        .iter()
        .filter(|value| {
            value["type"] == "message"
                && value["message"]["role"] == "assistant"
                && value["id"].as_str().is_some_and(|id| active.contains(id))
        })
        .map(|value| {
            let content = &value["message"]["content"];
            OmpAssistantText {
                text: omp_message_text(content, "\n"),
                concat: omp_message_text(content, ""),
            }
        })
        .filter(|message| !message.text.trim().is_empty())
        .collect())
}

pub(crate) fn parse_omp_interjections(path: &Path) -> Result<Vec<OmpInterjectionAnchor>, String> {
    let entries = read_omp_entries(path)?;
    let nodes: HashMap<_, _> = entries
        .iter()
        .filter_map(|value| value["id"].as_str().map(|id| (id, value)))
        .collect();
    let active = omp_active_ids(&entries);
    let mut assistants: HashMap<&str, (String, usize, String, usize)> = HashMap::new();
    let mut occurrences: HashMap<String, usize> = HashMap::new();
    let mut concat_occurrences: HashMap<String, usize> = HashMap::new();
    let mut out: Vec<OmpInterjectionAnchor> = Vec::new();
    // Metadata and compaction participate in ancestry, not anchor text.
    // Keep file order for occurrences and notes, but exclude abandoned branches.
    for value in &entries {
        if !value["id"].as_str().is_some_and(|id| active.contains(id)) {
            continue;
        }
        match value.get("type").and_then(serde_json::Value::as_str) {
            Some("message")
                if value
                    .pointer("/message/role")
                    .and_then(serde_json::Value::as_str)
                    == Some("assistant") =>
            {
                let Some(id) = value.get("id").and_then(serde_json::Value::as_str) else {
                    continue;
                };
                let text = omp_message_text(&value["message"]["content"], "\n");
                let concat_text = omp_message_text(&value["message"]["content"], "");
                if text.trim().is_empty() {
                    continue;
                }
                if let Some(anchor) = out.last_mut() {
                    let text_only = value["message"]["content"]
                        .as_array()
                        .is_some_and(|parts| parts.iter().all(|part| part["type"] == "text"));
                    if text_only
                        && value.get("parentId").and_then(serde_json::Value::as_str)
                            == Some(anchor.id.as_str())
                    {
                        anchor.following_assistant_text = Some(text.clone());
                        anchor.following_assistant_text_concat = Some(concat_text.clone());
                    }
                }
                let occurrence = occurrences.entry(text.clone()).or_default();
                *occurrence += 1;
                let concat_occurrence = concat_occurrences.entry(concat_text.clone()).or_default();
                *concat_occurrence += 1;
                assistants.insert(id, (text, *occurrence, concat_text, *concat_occurrence));
            }
            Some("custom_message")
                if value.get("display").and_then(serde_json::Value::as_bool) == Some(true) =>
            {
                let Some(id) = value.get("id").and_then(serde_json::Value::as_str) else {
                    continue;
                };
                let Some(parent_id) = value.get("parentId").and_then(serde_json::Value::as_str)
                else {
                    continue;
                };
                let mut ancestor = Some(parent_id);
                let mut seen = HashSet::new();
                let mut assistant = None;
                while let Some(id) = ancestor {
                    if !active.contains(id) || !seen.insert(id) {
                        break;
                    }
                    if let Some(found) = assistants.get(id) {
                        assistant = Some(found);
                        break;
                    }
                    let Some(parent) = nodes.get(id) else { break };
                    if matches!(
                        parent
                            .pointer("/message/role")
                            .and_then(serde_json::Value::as_str),
                        Some("user" | "assistant")
                    ) {
                        break;
                    }
                    ancestor = parent["parentId"].as_str();
                }
                let Some((after_assistant_text, after_occurrence, concat_text, concat_occurrence)) =
                    assistant
                else {
                    continue;
                };
                let custom_type = value
                    .get("customType")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or("custom")
                    .to_owned();
                let mut severity = None;
                let mut note_bodies = Vec::new();
                if custom_type == "advisor" {
                    for note in value
                        .pointer("/details/notes")
                        .and_then(serde_json::Value::as_array)
                        .into_iter()
                        .flatten()
                    {
                        if let Some(body) = note.get("note").and_then(serde_json::Value::as_str) {
                            note_bodies.push(body);
                        }
                        let next = note.get("severity").and_then(serde_json::Value::as_str);
                        if next == Some("blocker")
                            || (next == Some("concern") && severity.as_deref() != Some("blocker"))
                            || (next == Some("nit") && severity.is_none())
                        {
                            severity = next.map(str::to_owned);
                        }
                    }
                }
                let text = if note_bodies.is_empty() {
                    omp_message_text(&value["content"], "\n")
                } else {
                    note_bodies.join("\n\n")
                };
                // Tool results, metadata and note chains seal the same preceding
                // assistant prose. Notes resolving there stack in source order.
                out.push(OmpInterjectionAnchor {
                    id: id.to_owned(),
                    after_assistant_text: after_assistant_text.clone(),
                    after_occurrence: *after_occurrence,
                    after_assistant_text_concat: concat_text.clone(),
                    after_concat_occurrence: *concat_occurrence,
                    following_assistant_text: None,
                    following_assistant_text_concat: None,
                    text,
                    custom_type,
                    severity,
                });
            }
            _ => {}
        }
    }
    Ok(out)
}
