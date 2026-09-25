import { useEffect, useState } from "react";
import { useLocale } from "../../../lib/locale";
import {
  loadTerminalGpu,
  saveTerminalGpu,
  subscribeTerminalGpu,
} from "../../../lib/settings";
import {
  loadHardwareAcceleration,
  saveHardwareAcceleration,
  subscribeHardwareAcceleration,
} from "../../../lib/hardwareAcceleration";
import { Group, Row } from "../../settings/SettingsChrome";
import { Toggle } from "../../settings/SettingsControls";

export function PerformancePage() {
  const [hardwareAcceleration, setHardwareAcceleration] = useState(
    loadHardwareAcceleration,
  );
  const [terminalGpu, setTerminalGpu] = useState(loadTerminalGpu);
  const { t } = useLocale();
  // A change from anywhere else (another surface in this window) re-reads
  // both switches, so the gated toggle never shows a stale combination.
  useEffect(() => {
    const stopHardware = subscribeHardwareAcceleration(setHardwareAcceleration);
    const stopTerminal = subscribeTerminalGpu(setTerminalGpu);
    return () => {
      stopHardware();
      stopTerminal();
    };
  }, []);

  const onHardwareAcceleration = (next: boolean) => {
    saveHardwareAcceleration(next);
    setHardwareAcceleration(next);
  };

  const onTerminalGpu = (next: boolean) => {
    saveTerminalGpu(next);
    setTerminalGpu(next);
  };

  return (
    <>
      <Group
        title={t("settings.general.performance.title")}
        description={t("settings.general.performance.description")}
      >
        <Row
          id="hardware-acceleration"
          label={t("settings.general.hardware_acceleration.label")}
          description={t("settings.general.hardware_acceleration.description")}
        >
          <Toggle
            label={t("settings.general.hardware_acceleration.toggle")}
            on={hardwareAcceleration}
            onChange={onHardwareAcceleration}
          />
        </Row>
        <Row
          id="terminal-gpu"
          label={t("settings.general.terminal_gpu.label")}
          description={
            hardwareAcceleration
              ? t("settings.general.terminal_gpu.description")
              : `${t("settings.general.terminal_gpu.description")} ${t("settings.general.terminal_gpu.requires_master")}`
          }
        >
          <Toggle
            label={t("settings.general.terminal_gpu.toggle")}
            on={terminalGpu}
            onChange={onTerminalGpu}
            disabled={!hardwareAcceleration}
          />
        </Row>
      </Group>
    </>
  );
}
