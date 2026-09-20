import { useEffect, useMemo, useState } from "react";
import { SecondaryButton } from "../chrome/SecondaryButton";
import {
  deleteCustomPet,
  effectivePets,
  loadCustomPets,
  loadHiddenPets,
  restoreHiddenPets,
  saveCustomPet,
  setPetHidden,
  subscribePets,
  validateCustomPet,
} from "../lib/customPets";
import { MASCOT_GRID, mascotPath } from "../lib/projectMascots";
import { ProjectMascot } from "../chrome/ProjectMascot";

const EMPTY_FRAME = [
  "........",
  "........",
  "........",
  "........",
  "........",
  "........",
  "........",
  "........",
];

function FramePreview({ rows, className }: { rows: string[]; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${MASCOT_GRID} ${MASCOT_GRID}`}
      shapeRendering="crispEdges"
      fill="currentColor"
      className={className ?? "size-8"}
    >
      <path d={mascotPath(rows)} />
    </svg>
  );
}

function PixelEditor({
  frame,
  onChange,
}: {
  frame: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (y: number, x: number) => {
    const next = frame.map((row, rowIndex) =>
      rowIndex !== y
        ? row
        : row
            .split("")
            .map((cell, cellIndex) =>
              cellIndex === x ? (cell === "#" ? "." : "#") : cell,
            )
            .join(""),
    );
    onChange(next);
  };
  return (
    <div
      role="group"
      aria-label="Pixel editor"
      className="grid shrink-0 grid-cols-8 gap-px rounded-md border border-content/10 bg-content/5 p-1"
    >
      {frame.map((row, y) =>
        row.split("").map((cell, x) => (
          <button
            key={`${y}-${x}`}
            type="button"
            aria-label={`Pixel row ${y + 1} column ${x + 1} ${cell === "#" ? "filled" : "empty"}`}
            aria-pressed={cell === "#"}
            onClick={() => toggle(y, x)}
            className={`size-6 rounded-[2px] ${
              cell === "#"
                ? "bg-content/80"
                : "bg-transparent hover:bg-content/10"
            }`}
          />
        )),
      )}
    </div>
  );
}

function PetCreator({ taken }: { taken: ReadonlySet<string> }) {
  const [name, setName] = useState("");
  const [rest, setRest] = useState<string[]>(EMPTY_FRAME);
  const [talk, setTalk] = useState<string[]>(EMPTY_FRAME);
  const [frame, setFrame] = useState<"rest" | "talk">("rest");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const onSave = () => {
    const pet = validateCustomPet({ name, rest, talk }, taken);
    if (!pet) {
      setError(
        "Give it a unique name (letters, numbers, dashes) and keep both frames on the grid.",
      );
      setSaved(false);
      return;
    }
    saveCustomPet(pet);
    setName("");
    setRest(EMPTY_FRAME);
    setTalk(EMPTY_FRAME);
    setError(null);
    setSaved(true);
  };

  return (
    <div className="border-b border-content/5 px-4 py-3.5 last:border-b-0">
      <div className="text-[13px] font-medium text-content">Add a pet</div>
      <p className="mt-1 text-[12px] leading-relaxed text-content/45">
        Draw two 8×8 frames — resting and talking. Filled cells pick up the
        project color everywhere the pet appears.
      </p>
      <div className="mt-3 flex flex-wrap items-start gap-4">
        <PixelEditor
          frame={frame === "rest" ? rest : talk}
          onChange={frame === "rest" ? setRest : setTalk}
        />
        <div className="flex min-w-44 flex-1 flex-col gap-2">
          <div className="flex gap-1" role="group" aria-label="Frame">
            {(["rest", "talk"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={frame === value}
                onClick={() => setFrame(value)}
                className={`rounded-md px-2 py-1 text-[12px] capitalize ${
                  frame === value
                    ? "bg-content/10 text-content"
                    : "text-content/50 hover:text-content"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
          <FramePreview
            rows={frame === "rest" ? rest : talk}
            className="size-12 text-content/80"
          />
          <label className="flex h-7 w-52 max-w-full items-center rounded-md border border-content/10 px-2 focus-within:border-content/20">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Name your pet"
              aria-label="Pet name"
              spellCheck={false}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-[12px] text-content outline-none placeholder:text-content/35"
            />
          </label>
          <div className="flex items-center gap-2">
            <SecondaryButton onClick={onSave}>Save pet</SecondaryButton>
            {saved ? (
              <span role="status" className="text-[12px] text-content/50">
                Saved — pick it from any project menu.
              </span>
            ) : null}
          </div>
          {error ? (
            <p role="alert" className="text-[12px] text-red-400/90">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function PetsSettings() {
  const [revision, setRevision] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  useEffect(() => subscribePets(() => setRevision((value) => value + 1)), []);

  const pets = useMemo(() => effectivePets(), [revision]);
  const customs = useMemo(() => loadCustomPets(), [revision]);
  const hidden = useMemo(() => loadHiddenPets(), [revision]);
  const customNames = useMemo(
    () => new Set(customs.map((pet) => pet.name)),
    [customs],
  );
  const taken = useMemo(() => {
    const names = new Set<string>();
    for (const pet of effectivePets()) names.add(pet.name);
    for (const name of loadHiddenPets()) names.add(name);
    return names;
  }, [revision]);

  const onDelete = (name: string) => {
    if (confirmDelete !== name) {
      setConfirmDelete(name);
      return;
    }
    setConfirmDelete(null);
    deleteCustomPet(name);
  };

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2 border-b border-content/5 p-4 last:border-b-0">
        {pets.map((pet) => {
          const custom = customNames.has(pet.name);
          const confirming = confirmDelete === pet.name;
          return (
            <div
              key={pet.name}
              className="flex flex-col items-center gap-1 rounded-lg border border-content/10 px-2 py-2.5"
            >
              <ProjectMascot
                project=""
                name={pet.name}
                className="size-8 text-content/80"
              />
              <span className="max-w-full truncate text-[11px] text-content/60">
                {pet.name}
              </span>
              {custom ? (
                <button
                  type="button"
                  onClick={() => onDelete(pet.name)}
                  className={`rounded px-1.5 py-0.5 text-[11px] ${
                    confirming
                      ? "bg-red-500/20 text-red-300"
                      : "text-content/40 hover:bg-content/10 hover:text-content"
                  }`}
                >
                  {confirming ? "Confirm?" : "Delete"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setPetHidden(pet.name, true)}
                  className="rounded px-1.5 py-0.5 text-[11px] text-content/40 hover:bg-content/10 hover:text-content"
                >
                  Hide
                </button>
              )}
            </div>
          );
        })}
      </div>
      {hidden.length ? (
        <div className="border-b border-content/5 px-4 py-3.5 last:border-b-0">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[13px] font-medium text-content">
              Hidden ({hidden.length})
            </div>
            <SecondaryButton onClick={() => restoreHiddenPets()}>
              Restore all
            </SecondaryButton>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {hidden.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setPetHidden(name, false)}
                title={`Show ${name}`}
                className="flex items-center gap-1.5 rounded-md border border-content/10 px-2 py-1 text-[11px] text-content/50 opacity-60 hover:opacity-100"
              >
                <ProjectMascot
                  project=""
                  name={name}
                  className="size-4 text-content/60"
                />
                {name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <PetCreator taken={taken} />
    </>
  );
}
