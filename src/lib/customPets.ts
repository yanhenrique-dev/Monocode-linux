import {
  LEGACY_MASCOT_COUNT,
  PROJECT_MASCOTS,
  mascotPath,
  type ProjectMascot,
} from "./projectMascots";

/**
 * User-created pets and visibility of the built-in roster.
 *
 * A custom pet is two 8×8 pixel frames (`rest`/`talk`) in the same
 * `#`/`.` alphabet as the built-ins, so `mascotPath()` renders them with
 * no new renderer. Built-ins are never deleted — hiding removes them from
 * pickers while explicit picks and the hash fallback keep working, and
 * "restore" brings them back.
 *
 * Stability: the hash fallback always runs over the constant built-in list,
 * so adding, hiding, or deleting pets never reshuffles projects that rely
 * on it. Explicit picks resolve by name against everything (customs plus
 * all built-ins, hidden included).
 */

export type CustomPet = {
  name: string;
  rest: string[];
  talk: string[];
};

const CUSTOM_PETS_KEY = "monocode.pets.custom";
const HIDDEN_PETS_KEY = "monocode.pets.hidden";

/** Fired on `window` whenever customs or visibility change. */
export const PETS_CHANGE_EVENT = "monocode:pets-change";

function notifyPetsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PETS_CHANGE_EVENT));
}

export function subscribePets(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(PETS_CHANGE_EVENT, onStoreChange);
  return () => window.removeEventListener(PETS_CHANGE_EVENT, onStoreChange);
}

function readJsonArray(key: string): unknown[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // private mode / quota
  }
  notifyPetsChanged();
}

const GRID_SIZE = 8;

/** Normalizes a pet name to a slug, or null when unusable or taken. */
export function validatePetName(
  raw: unknown,
  taken: ReadonlySet<string>,
): string | null {
  if (typeof raw !== "string") return null;
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug || slug.length > 24 || taken.has(slug)) return null;
  return slug;
}

/** Normalizes an 8×8 `#`/`.` frame, or null when malformed. */
export function validatePetGrid(rows: unknown): string[] | null {
  if (!Array.isArray(rows) || rows.length !== GRID_SIZE) return null;
  const normalized: string[] = [];
  for (const row of rows) {
    if (typeof row !== "string" || row.length !== GRID_SIZE) return null;
    if (!/^[#.]+$/.test(row)) return null;
    normalized.push(row);
  }
  return normalized;
}

export function validateCustomPet(
  value: unknown,
  taken: ReadonlySet<string>,
): CustomPet | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const name = validatePetName(record.name, taken);
  const rest = validatePetGrid(record.rest);
  const talk = validatePetGrid(record.talk);
  if (!name || !rest || !talk) return null;
  return { name, rest, talk };
}

export function customPetNames(pets: readonly CustomPet[]): Set<string> {
  return new Set(pets.map((pet) => pet.name));
}

export function loadCustomPets(): CustomPet[] {
  const raw = readJsonArray(CUSTOM_PETS_KEY);
  const valid: CustomPet[] = [];
  const taken = new Set(PROJECT_MASCOTS.map((mascot) => mascot.name));
  for (const entry of raw) {
    const pet = validateCustomPet(entry, taken);
    if (!pet) continue;
    taken.add(pet.name);
    valid.push(pet);
  }
  return valid;
}

export function saveCustomPet(pet: CustomPet): CustomPet[] {
  const next = loadCustomPets().filter((item) => item.name !== pet.name);
  next.push(pet);
  writeJson(CUSTOM_PETS_KEY, next);
  return next;
}

/** Returns true when a pet was actually removed. */
export function deleteCustomPet(name: string): boolean {
  const current = loadCustomPets();
  const next = current.filter((item) => item.name !== name);
  if (next.length === current.length) return false;
  writeJson(CUSTOM_PETS_KEY, next);
  return true;
}

export function loadHiddenPets(): string[] {
  const builtIn = new Set(PROJECT_MASCOTS.map((mascot) => mascot.name));
  return readJsonArray(HIDDEN_PETS_KEY).filter(
    (name): name is string => typeof name === "string" && builtIn.has(name),
  );
}

function saveHiddenPets(names: readonly string[]) {
  writeJson(HIDDEN_PETS_KEY, [...names]);
}

export function isPetHidden(name: string): boolean {
  return loadHiddenPets().includes(name);
}

export function setPetHidden(name: string, hidden: boolean) {
  const builtIn = new Set(PROJECT_MASCOTS.map((mascot) => mascot.name));
  if (!builtIn.has(name)) return;
  const next = new Set(loadHiddenPets());
  if (hidden) next.add(name);
  else next.delete(name);
  saveHiddenPets([...next]);
}

/** Un-hides every built-in; customs are untouched. */
export function restoreHiddenPets() {
  saveHiddenPets([]);
}

function toMascot(pet: CustomPet): ProjectMascot {
  return {
    name: pet.name,
    rest: pet.rest,
    talk: pet.talk,
    restPath: mascotPath(pet.rest),
    talkPath: mascotPath(pet.talk),
  };
}

/** Built-ins minus hidden, then customs — the source for every picker. */
export function effectivePets(): ProjectMascot[] {
  const hidden = new Set(loadHiddenPets());
  return [
    ...PROJECT_MASCOTS.filter((mascot) => !hidden.has(mascot.name)),
    ...loadCustomPets().map(toMascot),
  ];
}

/**
 * Explicit pick wins (customs plus all built-ins, hidden included);
 * otherwise the stable hash fallback over the constant built-in roster.
 */
export function resolveEffectiveMascot(
  project: string,
  name?: string | null,
): ProjectMascot {
  if (name) {
    const custom = loadCustomPets().find((pet) => pet.name === name);
    if (custom) return toMascot(custom);
    const builtIn = PROJECT_MASCOTS.find((mascot) => mascot.name === name);
    if (builtIn) return builtIn;
  }
  let hash = 0;
  for (let i = 0; i < project.length; i++) {
    hash = (hash * 131 + project.charCodeAt(i)) >>> 0;
  }
  return PROJECT_MASCOTS[hash % LEGACY_MASCOT_COUNT];
}
