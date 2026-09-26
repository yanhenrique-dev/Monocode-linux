import { homeDir } from "../fs";
import { setHarnessModels } from "../models";
import { execChild, resolveFxBinary } from "./child";
import {
  mergeFxCatalogModels,
  modelFromFxStatusOutput,
  modelsFromFxOutput,
} from "./fxProtocol";
import { HARNESS_EXEC } from "./harnessContract";

let inflight: Promise<void> | null = null;

export function refreshFxCatalog(): Promise<void> {
  if (inflight) return inflight;
  inflight = discoverFxModels()
    .then((models) => {
      if (models.length > 0) setHarnessModels("fx", models);
    })
    .catch((error: unknown) => {
      console.debug("[monocode] fx catalog", error);
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

async function discoverFxModels() {
  const { path } = await resolveFxBinary();
  const cwd = await homeDir();
  const [modelsOutput, statusOutput] = await Promise.all([
    execChild(path, HARNESS_EXEC.modelsJson, cwd),
    execChild(path, HARNESS_EXEC.statusJson, cwd).catch(() => ""),
  ]);
  return mergeFxCatalogModels(
    modelsFromFxOutput(modelsOutput),
    modelFromFxStatusOutput(statusOutput),
  );
}
