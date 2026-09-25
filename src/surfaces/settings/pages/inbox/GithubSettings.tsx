import { openExternalBestEffort } from "../../../../lib/openExternal";
import { useCallback, useEffect, useRef, useState } from "react";
import { SecondaryButton } from "../../../../chrome/SecondaryButton";
import { githubStatus, type GithubStatus } from "../../../../lib/githubTasks";
import { useLocale } from "../../../../lib/locale";
import { Row } from "../../../settings/SettingsChrome";

export function GithubSettings() {
  const [status, setStatus] = useState<GithubStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const { t } = useLocale();

  const checkStatus = useCallback(async () => {
    const generation = ++request.current;
    setChecking(true);
    setError(null);
    try {
      const next = await githubStatus();
      if (generation === request.current) setStatus(next);
    } catch (err: unknown) {
      if (generation === request.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (generation === request.current) setChecking(false);
    }
  }, []);

  useEffect(() => {
    void checkStatus();
    return () => {
      request.current += 1;
    };
  }, [checkStatus]);

  const description = status?.connected
    ? t("settings.inbox.github.connection.connected")
    : status?.installed
      ? t("settings.inbox.github.connection.auth_needed")
      : t("settings.inbox.github.connection.not_installed");
  const label = checking
    ? t("settings.inbox.github.connection.checking")
    : status?.connected
      ? t("settings.inbox.github.connection.connected_status")
      : status?.installed
        ? t("settings.inbox.github.connection.sign_in_required")
        : t("settings.inbox.github.connection.not_installed_status");

  return (
    <>
      <Row
        label={t("settings.inbox.github.connection.label")}
        description={description}
      >
        <span className="text-[12px] text-content/50">{label}</span>
        {!checking && !status?.installed ? (
          <SecondaryButton
            onClick={() => {
              openExternalBestEffort("https://cli.github.com/");
            }}
          >
            {t("settings.inbox.github.connection.installation_guide")}
          </SecondaryButton>
        ) : null}
        <SecondaryButton onClick={() => void checkStatus()} disabled={checking}>
          {checking
            ? t("settings.inbox.github.connection.checking_button")
            : t("settings.inbox.github.connection.check_again")}
        </SecondaryButton>
      </Row>
      {error ? (
        <p
          role="alert"
          className="border-b border-content/10 px-4 pb-4 text-[12px] text-red-400/90 last:border-b-0"
        >
          {error}
        </p>
      ) : null}
    </>
  );
}
