import { useEffect, useRef } from "react";
import {
  UPDATE_POLL_INTERVAL_MS,
  probeForUpdate,
  readAppVersion,
  shouldBackgroundCheck,
  type UpdaterSnapshot,
} from "../lib/updater";

/**
 * Background update poll: one check at startup (jittered 5-20s so all
 * installs don't hit GitHub at once), then every 6h, plus on window focus
 * when interval elapsed. Single-flight inside probeForUpdate dedupes
 * concurrent callers across components.
 */
export function useAutoUpdateCheck(onSnapshot?: (snapshot: UpdaterSnapshot) => void): void {
  // Ref: inline callbacks change identity per render; the effect must not
  // restart its startup timer because of that.
  const onSnapshotRef = useRef(onSnapshot);
  onSnapshotRef.current = onSnapshot;

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!shouldBackgroundCheck()) return;
      try {
        const update = await probeForUpdate([0, 1000]);
        if (cancelled) return;
        if (!update) return;
        const currentVersion = await readAppVersion();
        if (cancelled) return;
        onSnapshotRef.current?.({
          phase: "available",
          currentVersion,
          availableVersion: update.version,
        });
      } catch {
        // Silent: sidebar stays hidden, Settings surfaces error on manual check.
      }
    };

    const jitter = 5000 + Math.floor(Math.random() * 15000);
    const startupTimer = setTimeout(() => {
      void run();
    }, jitter);

    const interval = setInterval(() => {
      void run();
    }, UPDATE_POLL_INTERVAL_MS);

    const focusHandler = () => {
      if (document.visibilityState === "visible") void run();
    };
    window.addEventListener("focus", focusHandler);
    document.addEventListener("visibilitychange", focusHandler);

    return () => {
      cancelled = true;
      clearTimeout(startupTimer);
      clearInterval(interval);
      window.removeEventListener("focus", focusHandler);
      document.removeEventListener("visibilitychange", focusHandler);
    };
  }, []);
}
