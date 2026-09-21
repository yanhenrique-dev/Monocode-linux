import {
  Archive,
  ArrowLeft,
  Bell,
  Bot,
  FolderTree,
  Gauge,
  Inbox,
  Keyboard,
  MessageSquare,
  Palette,
  SlidersHorizontal,
  Sparkles,
  type IconComponent,
} from "./icons";
import { useLockOverscroll } from "../hooks/useLockOverscroll";
import {
  settingsSectionsByGroup,
  type SettingsSectionId,
} from "../lib/settings";
import { useLocale } from "../lib/locale";

const SECTION_ICONS: Record<SettingsSectionId, IconComponent> = {
  general: SlidersHorizontal,
  notifications: Bell,
  performance: Gauge,
  appearance: Palette,
  keybindings: Keyboard,
  chat: MessageSquare,
  providers: Bot,
  skills: Sparkles,
  inbox: Inbox,
  worktrees: FolderTree,
  archive: Archive,
};

type Props = {
  section: SettingsSectionId;
  onSelect: (section: SettingsSectionId) => void;
  onClose: () => void;
};

/** Body of the project rail while settings are open. */
export function SettingsNav({ section, onSelect, onClose }: Props) {
  const lockOverscroll = useLockOverscroll<HTMLDivElement>();
  const { t } = useLocale();

  return (
    <>
      <div
        ref={lockOverscroll}
        aria-label={t("settings.header.region_aria")}
        className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-none px-2 py-4"
      >
        {settingsSectionsByGroup().map((group) => (
          <div key={group.id} className="flex flex-col gap-1">
            <div className="px-2 pb-1 text-xs font-semibold text-content/50">
              {t(group.label)}
            </div>
            {group.sections.map((item) => (
              <NavRow
                key={item.id}
                label={t(item.label)}
                icon={SECTION_ICONS[item.id]}
                active={item.id === section}
                onClick={() => onSelect(item.id)}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex shrink-0 flex-col gap-1 p-2">
        <NavRow
          label={t("settings.header.back")}
          icon={ArrowLeft}
          onClick={onClose}
        />
      </div>
    </>
  );
}

function NavRow({
  label,
  icon: Icon,
  active = false,
  onClick,
}: {
  label: string;
  icon: IconComponent;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left ${
        active
          ? "bg-selection text-content"
          : "text-content/50 hover:bg-content/5 hover:text-content"
      }`}
    >
      <Icon className="size-4 shrink-0" strokeWidth={1.75} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium leading-tight">
        {label}
      </span>
    </button>
  );
}
