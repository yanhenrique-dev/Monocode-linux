import { InboxProviderMark } from "../../../chrome/InboxProviderMark";
import { useLocale } from "../../../lib/locale";
import { Group } from "../../settings/SettingsChrome";
import { GithubSettings } from "./inbox/GithubSettings";
import { GitlabSettings } from "./inbox/GitlabSettings";
import { LinearSettings } from "./inbox/LinearSettings";

export function InboxPage() {
  const { t } = useLocale();
  return (
    <>
      <Group
        id="github"
        title={
          <span className="flex items-center gap-2">
            <InboxProviderMark provider="github" className="size-4 shrink-0" />
            {t("settings.inbox.github.title")}
          </span>
        }
        description={t("settings.inbox.github.description")}
      >
        <GithubSettings />
      </Group>

      <Group
        id="gitlab"
        title={
          <span className="flex items-center gap-2">
            <InboxProviderMark provider="gitlab" className="size-4 shrink-0" />
            {t("settings.inbox.gitlab.title")}
          </span>
        }
        description={t("settings.inbox.gitlab.description")}
      >
        <GitlabSettings />
      </Group>

      <Group
        id="linear"
        title={
          <span className="flex items-center gap-2">
            <InboxProviderMark provider="linear" className="size-4 shrink-0" />
            {t("settings.inbox.linear.title")}
          </span>
        }
        description={t("settings.inbox.linear.description")}
      >
        <LinearSettings />
      </Group>
    </>
  );
}
