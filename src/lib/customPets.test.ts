import { beforeEach, describe, expect, it } from "vitest";
import {
  deleteCustomPet,
  effectivePets,
  isPetHidden,
  loadCustomPets,
  loadHiddenPets,
  resolveEffectiveMascot,
  restoreHiddenPets,
  saveCustomPet,
  setPetHidden,
  validateCustomPet,
  validatePetGrid,
  validatePetName,
  type CustomPet,
} from "./customPets";
import { PROJECT_MASCOTS, projectMascot } from "./projectMascots";
import { loadTabGroupMascots } from "./tabGroups";

function mockLocalStorage() {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
      removeItem: (key: string) => {
        data.delete(key);
      },
      clear: () => {
        data.clear();
      },
    },
    configurable: true,
  });
}

const REST = [
  "########",
  "#......#",
  "#.####.#",
  "#.####.#",
  "#......#",
  "########",
  "........",
  "........",
];
const TALK = [
  "########",
  "#......#",
  "#.####.#",
  "#......#",
  "#.####.#",
  "#......#",
  "########",
  "........",
];

beforeEach(mockLocalStorage);

describe("pet validation", () => {
  it("slugs names and rejects taken ones", () => {
    const taken = new Set(["cat"]);
    expect(validatePetName("My Pet", taken)).toBe("my-pet");
    expect(validatePetName("  Cat  ", taken)).toBeNull();
    expect(validatePetName("invader", new Set(["invader"]))).toBeNull();
    expect(validatePetName("", taken)).toBeNull();
    expect(validatePetName("a".repeat(25), taken)).toBeNull();
  });

  it("accepts only 8x8 #/. frames", () => {
    expect(validatePetGrid(REST)).toEqual(REST);
    expect(validatePetGrid(REST.slice(0, 7))).toBeNull();
    expect(validatePetGrid([...REST.slice(0, 7), "short"])).toBeNull();
    expect(validatePetGrid([...REST.slice(0, 7), "#x......"])).toBeNull();
  });

  it("validates a whole custom pet", () => {
    expect(
      validateCustomPet({ name: "blob", rest: REST, talk: TALK }, new Set()),
    ).toEqual({ name: "blob", rest: REST, talk: TALK });
    expect(
      validateCustomPet({ name: "blob", rest: REST }, new Set()),
    ).toBeNull();
  });
});

describe("custom pet store", () => {
  it("saves, loads, and deletes customs", () => {
    expect(loadCustomPets()).toEqual([]);
    saveCustomPet({ name: "blob", rest: REST, talk: TALK });
    expect(loadCustomPets().map((pet) => pet.name)).toEqual(["blob"]);
    expect(deleteCustomPet("missing")).toBe(false);
    expect(deleteCustomPet("blob")).toBe(true);
    expect(loadCustomPets()).toEqual([]);
  });

  it("drops invalid stored entries", () => {
    const pet: CustomPet = { name: "blob", rest: REST, talk: TALK };
    localStorage.setItem(
      "monocode.pets.custom",
      JSON.stringify([pet, { name: "bad" }, "nope"]),
    );
    expect(loadCustomPets()).toEqual([pet]);
  });

  it("renames colliding custom pets and saved mascot selections", () => {
    localStorage.setItem(
      "monocode.pets.custom",
      JSON.stringify([{ name: "bee", rest: REST, talk: TALK }]),
    );
    localStorage.setItem(
      "monocode:tab-group:mascots",
      JSON.stringify({ "/repo": "bee" }),
    );

    expect(loadCustomPets().map((pet) => pet.name)).toEqual(["bee-custom"]);
    expect(loadTabGroupMascots()["/repo"]).toBe("bee-custom");
    expect(loadCustomPets().map((pet) => pet.name)).toEqual(["bee-custom"]);
  });
});

describe("built-in visibility", () => {
  it("hides, shows, and restores", () => {
    expect(loadHiddenPets()).toEqual([]);
    setPetHidden("cat", true);
    expect(isPetHidden("cat")).toBe(true);
    expect(loadHiddenPets()).toEqual(["cat"]);
    setPetHidden("cat", false);
    expect(isPetHidden("cat")).toBe(false);
    setPetHidden("cat", true);
    restoreHiddenPets();
    expect(loadHiddenPets()).toEqual([]);
  });

  it("ignores unknown names", () => {
    setPetHidden("dragon", true);
    expect(loadHiddenPets()).toEqual([]);
  });
});

describe("effective collection", () => {
  it("merges visible built-ins with customs", () => {
    saveCustomPet({ name: "blob", rest: REST, talk: TALK });
    setPetHidden("cat", true);
    const names = effectivePets().map((pet) => pet.name);
    expect(names).toContain("blob");
    expect(names).not.toContain("cat");
    expect(names).toContain("ghost");
    const blob = effectivePets().find((pet) => pet.name === "blob")!;
    expect(blob.restPath.length).toBeGreaterThan(0);
    expect(blob.talkPath.length).toBeGreaterThan(0);
  });
});

describe("mascot resolution", () => {
  it("resolves explicit customs and hidden built-ins by name", () => {
    saveCustomPet({ name: "blob", rest: REST, talk: TALK });
    setPetHidden("cat", true);
    expect(resolveEffectiveMascot("/repo", "blob").name).toBe("blob");
    expect(resolveEffectiveMascot("/repo", "cat").name).toBe("cat");
    expect(resolveEffectiveMascot("/repo", "nope").name).toBe(
      projectMascot("/repo").name,
    );
  });

  it("keeps the hash fallback stable when the collection changes", () => {
    const before = resolveEffectiveMascot("/some/project").name;
    saveCustomPet({ name: "blob", rest: REST, talk: TALK });
    setPetHidden("ghost", true);
    expect(resolveEffectiveMascot("/some/project").name).toBe(before);
    expect(PROJECT_MASCOTS.map((mascot) => mascot.name)).toContain(before);
  });
});
