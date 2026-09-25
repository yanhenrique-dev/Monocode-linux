import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  applyChatBackground,
  applyChatBackgroundBlur,
  applyChatBackgroundEmptyOpacity,
  applyChatBackgroundSessionOpacity,
  applyChatBackgroundScope,
  applyAccentColor,
  applyBodyGlass,
  applySidebarBlur,
  applySidebarOpacity,
  applyUiBlur,
  applyThemeDarkLightness,
  applyThemePreference,
  applyThemeTint,
  cancelSidebarBlurPreview,
  BODY_GLASS_DEFAULT,
  ACCENT_COLOR_DEFAULT,
  CHAT_BACKGROUND_BLUR_DEFAULT,
  CHAT_BACKGROUND_EMPTY_OPACITY_DEFAULT,
  CHAT_BACKGROUND_SESSION_OPACITY_DEFAULT,
  CHAT_BACKGROUND_SCOPE_DEFAULT,
  NEW_THREAD_BACKGROUND_EFFECT_DEFAULT,
  THEME_PREFERENCE_DEFAULT,
  UI_BLUR_DEFAULT,
  loadBodyGlass,
  loadAccentColor,
  loadChatBackgroundBlur,
  loadChatBackgroundEmptyOpacity,
  loadChatBackgroundPath,
  loadChatBackgroundSessionOpacity,
  loadChatBackgroundScope,
  loadNewThreadBackgroundEffect,
  loadThemeDarkLightness,
  loadThemePreference,
  loadSidebarBlur,
  loadSidebarOpacity,
  loadThemeHue,
  loadThemeSaturation,
  loadUiBlur,
  previewSidebarBlur,
  saveBodyGlass,
  saveAccentColor,
  saveChatBackgroundBlur,
  saveChatBackgroundEmptyOpacity,
  saveChatBackgroundPath,
  saveChatBackgroundSessionOpacity,
  saveChatBackgroundScope,
  setNewThreadBackgroundEffect,
  saveThemeDarkLightness,
  saveThemePreference,
  saveSidebarBlur,
  saveSidebarOpacity,
  saveThemeHue,
  saveThemeSaturation,
  saveUiBlur,
  subscribeAppearance,
  SIDEBAR_BLUR_DEFAULT,
  SIDEBAR_OPACITY_DEFAULT,
  THEME_DARK_LIGHTNESS_DEFAULT,
  THEME_HUE_DEFAULT,
  THEME_SATURATION_DEFAULT,
  type ThemePreference,
  type ChatBackgroundScope,
  type NewThreadBackgroundEffect,
} from "../../lib/appearance";
import {
  pickAndSaveChatBackground,
  removeChatBackground,
} from "../../lib/chatBackground";
import {
  applyUiScale,
  loadUiScale,
  saveUiScale,
  subscribeUiScale,
  UI_SCALE_DEFAULT,
} from "../../lib/uiScale";

export function useAppearanceSettings() {
  const [themePreference, setThemePreference] =
    useState<ThemePreference>(loadThemePreference);
  const [accentColor, setAccentColor] = useState(loadAccentColor);
  const [opacity, setOpacity] = useState(loadSidebarOpacity);
  const [blur, setBlur] = useState(loadSidebarBlur);
  const [themeHue, setThemeHue] = useState(loadThemeHue);
  const [themeSaturation, setThemeSaturation] = useState(loadThemeSaturation);
  const [themeDarkLightness, setThemeDarkLightness] = useState(
    loadThemeDarkLightness,
  );
  const [bodyGlass, setBodyGlass] = useState(loadBodyGlass);
  const [uiBlur, setUiBlur] = useState(loadUiBlur);
  const [chatBackgroundPath, setChatBackgroundPath] = useState(
    loadChatBackgroundPath,
  );
  // Mirror for syncAppearanceFromStore: applyChatBackground bumps the image
  // revision on every call, so the sync paints only on a real path change.
  // Layout-phase sync: a synchronous appearance notification between commit
  // and a passive effect would otherwise read a stale ref.
  const chatBackgroundPathRef = useRef<string | null>(chatBackgroundPath);
  useLayoutEffect(() => {
    chatBackgroundPathRef.current = chatBackgroundPath;
  }, [chatBackgroundPath]);
  const [chatBackgroundEmptyOpacity, setChatBackgroundEmptyOpacity] = useState(
    loadChatBackgroundEmptyOpacity,
  );
  const [chatBackgroundSessionOpacity, setChatBackgroundSessionOpacity] =
    useState(loadChatBackgroundSessionOpacity);
  const [chatBackgroundBlur, setChatBackgroundBlur] = useState(
    loadChatBackgroundBlur,
  );
  const [chatBackgroundScope, setChatBackgroundScope] =
    useState<ChatBackgroundScope>(loadChatBackgroundScope);
  const [newThreadBackgroundEffect, setBackgroundEffect] =
    useState<NewThreadBackgroundEffect>(loadNewThreadBackgroundEffect);
  const [chatBackgroundBusy, setChatBackgroundBusy] = useState(false);
  const [chatBackgroundError, setChatBackgroundError] = useState<string | null>(
    null,
  );
  const [uiScale, setUiScale] = useState(loadUiScale);

  useEffect(() => subscribeUiScale(() => setUiScale(loadUiScale())), []);

  const onThemePreference = useCallback((next: ThemePreference) => {
    applyThemePreference(next);
    saveThemePreference(next);
    setThemePreference(next);
  }, []);

  const onAccentColor = useCallback((value: string | null) => {
    const next = applyAccentColor(value);
    saveAccentColor(next);
    setAccentColor(next);
  }, []);

  // Drag preview: paint only. No persist, no parent-wide side effects; the
  // exact value is committed on release via the onX handler.
  const previewAccentColor = useCallback((value: string | null) => {
    applyAccentColor(value);
  }, []);

  const previewTint = useCallback((hue: number, saturation: number) => {
    const next = applyThemeTint(hue, saturation);
    setThemeHue(next.hue);
    setThemeSaturation(next.saturation);
  }, []);

  const previewDarkLightness = useCallback((value: number) => {
    setThemeDarkLightness(applyThemeDarkLightness(value));
  }, []);

  const previewOpacity = useCallback((percent: number) => {
    setOpacity(applySidebarOpacity(percent / 100));
  }, []);

  const previewBlur = useCallback((radius: number) => {
    setBlur(previewSidebarBlur(radius));
  }, []);

  const previewChatBackgroundEmptyOpacity = useCallback((percent: number) => {
    setChatBackgroundEmptyOpacity(
      applyChatBackgroundEmptyOpacity(percent / 100),
    );
  }, []);

  const previewChatBackgroundSessionOpacity = useCallback((percent: number) => {
    setChatBackgroundSessionOpacity(
      applyChatBackgroundSessionOpacity(percent / 100),
    );
  }, []);

  const previewUiScale = useCallback((percent: number) => {
    // No setZoom while dragging: relayouting the whole app under the pointer
    // fights the drag. The zoom commits on release.
    setUiScale(percent / 100);
  }, []);

  const onOpacity = useCallback((percent: number) => {
    const next = applySidebarOpacity(percent / 100);
    saveSidebarOpacity(next);
    setOpacity(next);
  }, []);

  const onBlur = useCallback((radius: number) => {
    cancelSidebarBlurPreview();
    const next = applySidebarBlur(radius);
    saveSidebarBlur(next);
    setBlur(next);
  }, []);

  const onTint = useCallback((hue: number, saturation: number) => {
    const next = applyThemeTint(hue, saturation);
    saveThemeHue(next.hue);
    saveThemeSaturation(next.saturation);
    setThemeHue(next.hue);
    setThemeSaturation(next.saturation);
  }, []);

  const onDarkLightness = useCallback((value: number) => {
    const next = applyThemeDarkLightness(value);
    saveThemeDarkLightness(next);
    setThemeDarkLightness(next);
  }, []);

  const onBodyGlass = useCallback((next: boolean) => {
    applyBodyGlass(next);
    saveBodyGlass(next);
    setBodyGlass(next);
  }, []);

  const onUiBlur = useCallback((next: boolean) => {
    applyUiBlur(next);
    saveUiBlur(next);
    setUiBlur(next);
  }, []);

  const onChooseChatBackground = useCallback(async () => {
    setChatBackgroundBusy(true);
    setChatBackgroundError(null);
    try {
      const path = await pickAndSaveChatBackground();
      if (!path) return;
      saveChatBackgroundPath(path);
      applyChatBackground(path);
      setChatBackgroundPath(path);
    } catch (error) {
      setChatBackgroundError(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setChatBackgroundBusy(false);
    }
  }, []);

  const onClearChatBackground = useCallback(async () => {
    setChatBackgroundBusy(true);
    setChatBackgroundError(null);
    try {
      await removeChatBackground();
      saveChatBackgroundPath(null);
      applyChatBackground(null);
      setChatBackgroundPath(null);
    } catch (error) {
      setChatBackgroundError(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setChatBackgroundBusy(false);
    }
  }, []);

  const onChatBackgroundEmptyOpacity = useCallback((percent: number) => {
    const next = applyChatBackgroundEmptyOpacity(percent / 100);
    saveChatBackgroundEmptyOpacity(next);
    setChatBackgroundEmptyOpacity(next);
  }, []);

  const onChatBackgroundSessionOpacity = useCallback((percent: number) => {
    const next = applyChatBackgroundSessionOpacity(percent / 100);
    saveChatBackgroundSessionOpacity(next);
    setChatBackgroundSessionOpacity(next);
  }, []);

  const previewChatBackgroundBlur = useCallback((radius: number) => {
    setChatBackgroundBlur(applyChatBackgroundBlur(radius));
  }, []);

  const onChatBackgroundBlur = useCallback((radius: number) => {
    const next = applyChatBackgroundBlur(radius);
    saveChatBackgroundBlur(next);
    setChatBackgroundBlur(next);
  }, []);

  const onChatBackgroundScope = useCallback((next: ChatBackgroundScope) => {
    applyChatBackgroundScope(next);
    saveChatBackgroundScope(next);
    setChatBackgroundScope(next);
  }, []);

  const onNewThreadBackgroundEffect = useCallback(
    (next: NewThreadBackgroundEffect) => {
      setNewThreadBackgroundEffect(next);
      setBackgroundEffect(next);
    },
    [],
  );

  const onUiScale = useCallback((percent: number) => {
    const next = saveUiScale(percent / 100);
    setUiScale(next);
    void applyUiScale(next);
  }, []);

  // Re-reads every owned value from the store without persisting. Also
  // serves the drag-abort and unmount paths (as revertAppearanceDrafts
  // below): one body, two names, so the two call sites never drift apart.
  const syncAppearanceFromStore = useCallback(() => {
    cancelSidebarBlurPreview();
    setThemePreference(applyThemePreference(loadThemePreference()));
    const tint = applyThemeTint(loadThemeHue(), loadThemeSaturation());
    setThemeHue(tint.hue);
    setThemeSaturation(tint.saturation);
    setBodyGlass(applyBodyGlass(loadBodyGlass()));
    setUiBlur(applyUiBlur(loadUiBlur()));
    const darkLightness = applyThemeDarkLightness(loadThemeDarkLightness());
    setThemeDarkLightness(darkLightness);
    const nextOpacity = applySidebarOpacity(loadSidebarOpacity());
    setOpacity(nextOpacity);
    const nextBlur = applySidebarBlur(loadSidebarBlur());
    setBlur(nextBlur);
    const nextAccent = applyAccentColor(loadAccentColor());
    setAccentColor(nextAccent);
    const empty = applyChatBackgroundEmptyOpacity(
      loadChatBackgroundEmptyOpacity(),
    );
    setChatBackgroundEmptyOpacity(empty);
    const session = applyChatBackgroundSessionOpacity(
      loadChatBackgroundSessionOpacity(),
    );
    setChatBackgroundSessionOpacity(session);
    const bgBlur = applyChatBackgroundBlur(loadChatBackgroundBlur());
    setChatBackgroundBlur(bgBlur);
    setChatBackgroundScope(applyChatBackgroundScope(loadChatBackgroundScope()));
    setBackgroundEffect(loadNewThreadBackgroundEffect());
    // State drives the background section visibility; paint only on a real
    // change — applyChatBackground bumps the image revision every call.
    const bgPath = loadChatBackgroundPath();
    if (bgPath !== chatBackgroundPathRef.current) {
      chatBackgroundPathRef.current = bgPath;
      applyChatBackground(bgPath);
    }
    setChatBackgroundPath(bgPath);
    const scale = loadUiScale();
    setUiScale(scale);
    void applyUiScale(scale);
  }, []);

  // Restore the persisted look after an abandoned drag preview or an
  // unmount mid-preview (popover closed, page left). Same body as the sync
  // above by construction.
  const revertAppearanceDrafts = syncAppearanceFromStore;

  // A persisted change from anywhere else in this window (another Settings
  // surface) re-reads the store, so two editors never show different looks.
  const syncRef = useRef(syncAppearanceFromStore);
  syncRef.current = syncAppearanceFromStore;
  useEffect(
    () =>
      subscribeAppearance(() => {
        syncRef.current();
      }),
    [],
  );

  const restoreDefaults = useCallback(() => {
    onThemePreference(THEME_PREFERENCE_DEFAULT);
    onAccentColor(ACCENT_COLOR_DEFAULT);
    onOpacity(Math.round(SIDEBAR_OPACITY_DEFAULT * 100));
    onBlur(SIDEBAR_BLUR_DEFAULT);
    onTint(THEME_HUE_DEFAULT, THEME_SATURATION_DEFAULT);
    onDarkLightness(THEME_DARK_LIGHTNESS_DEFAULT);
    onBodyGlass(BODY_GLASS_DEFAULT);
    onUiBlur(UI_BLUR_DEFAULT);
    onChatBackgroundEmptyOpacity(
      Math.round(CHAT_BACKGROUND_EMPTY_OPACITY_DEFAULT * 100),
    );
    onChatBackgroundSessionOpacity(
      Math.round(CHAT_BACKGROUND_SESSION_OPACITY_DEFAULT * 100),
    );
    onChatBackgroundBlur(CHAT_BACKGROUND_BLUR_DEFAULT);
    onChatBackgroundScope(CHAT_BACKGROUND_SCOPE_DEFAULT);
    onNewThreadBackgroundEffect(NEW_THREAD_BACKGROUND_EFFECT_DEFAULT);
    if (chatBackgroundPath) void onClearChatBackground();
    onUiScale(Math.round(UI_SCALE_DEFAULT * 100));
  }, [
    chatBackgroundPath,
    onBlur,
    onBodyGlass,
    onUiBlur,
    onChatBackgroundEmptyOpacity,
    onChatBackgroundSessionOpacity,
    onChatBackgroundBlur,
    onChatBackgroundScope,
    onClearChatBackground,
    onAccentColor,
    onThemePreference,
    onOpacity,
    onTint,
    onDarkLightness,
    onUiScale,
  ]);

  return {
    themePreference,
    accentColor,
    opacity,
    blur,
    themeHue,
    themeSaturation,
    themeDarkLightness,
    bodyGlass,
    uiBlur,
    chatBackgroundPath,
    chatBackgroundEmptyOpacity,
    chatBackgroundSessionOpacity,
    chatBackgroundBlur,
    chatBackgroundScope,
    newThreadBackgroundEffect,
    chatBackgroundBusy,
    chatBackgroundError,
    uiScale,
    onThemePreference,
    onAccentColor,
    onOpacity,
    onBlur,
    onTint,
    onDarkLightness,
    onBodyGlass,
    onUiBlur,
    onChooseChatBackground,
    onClearChatBackground,
    onChatBackgroundEmptyOpacity,
    onChatBackgroundSessionOpacity,
    onChatBackgroundBlur,
    onChatBackgroundScope,
    onNewThreadBackgroundEffect,
    onUiScale,
    restoreDefaults,
    revertAppearanceDrafts,
    previewAccentColor,
    previewTint,
    previewDarkLightness,
    previewOpacity,
    previewBlur,
    previewChatBackgroundEmptyOpacity,
    previewChatBackgroundSessionOpacity,
    previewChatBackgroundBlur,
    previewUiScale,
  };
}

export type AppearanceSettings = ReturnType<typeof useAppearanceSettings>;
