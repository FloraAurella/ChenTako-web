import {
  createThemePackage,
  downloadThemePackage,
  parseThemePackage,
  serializeThemePackage,
  serializableThemeDefinition,
  THEME_PACKAGE_MAX_BYTES,
  themePackageFilename
} from "../domain/package.js";
import { listThemes, registerTheme, unregisterTheme } from "../domain/registry.js";
import { removeUserThemeFile } from "../domain/user-theme.js";
import {
  applySurfaceAppearance,
  readSurfaceAppearance,
  removeThemeAppearance,
  replaceThemeAppearance,
  setSurfaceContrast,
  setTransparentMode
} from "../surface.js";
import type { SettingsDependencies, SettingsStateBridge } from "../../../contracts/settings";

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function chooseFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.addEventListener("change", () => resolve(input.files?.[0] || null), { once: true });
    input.click();
  });
}

/** 主题和纯色表面外观变更保持框架无关，只通过 bridge 请求 React 刷新。 */
export function createAppearanceSettingsService(
  dependencies: SettingsDependencies,
  stateBridge: SettingsStateBridge
) {
  const { theme, dialogs, toast } = dependencies;
  const refresh = () => stateBridge.patch({});

  function clearAppearanceOverride(): void {
    stateBridge.patch({ appearanceOverride: null });
  }

  function setAppearanceMode(mode: "system" | "light" | "dark"): void {
    theme.setAppearanceMode(mode);
    const label = mode === "system" ? "跟随系统" : mode === "dark" ? "深色" : "浅色";
    toast(`已切换到${label}模式`, { tone: "ok" });
    clearAppearanceOverride();
  }

  function activateTheme(id: string): void {
    const entry = listThemes().find((item: any) => item.id === id);
    if (!entry) return;
    theme.activateTheme(id);
    toast(`已切换到「${entry.label}」`, { tone: "ok" });
    clearAppearanceOverride();
  }

  function setContrast(value: number): void {
    const current = theme.current();
    const contrast = setSurfaceContrast(value, current.themeId, current.scheme);
    stateBridge.patch({
      appearanceOverride: {
        themeId: current.themeId,
        scheme: current.scheme,
        contrast
      }
    });
  }

  function setTransparent(enabled: boolean): void {
    const current = theme.current();
    const transparent = setTransparentMode(enabled, current.themeId, current.scheme);
    const previous = stateBridge.get().appearanceOverride;
    stateBridge.patch({
      appearanceOverride: {
        ...(previous && previous.themeId === current.themeId && previous.scheme === current.scheme ? previous : {}),
        themeId: current.themeId,
        scheme: current.scheme,
        transparent
      }
    });
  }

  async function importThemeJson(file?: File | null): Promise<void> {
    if (!file) return;
    if (file.size <= 0 || file.size > THEME_PACKAGE_MAX_BYTES) {
      toast(`主题 JSON 不能超过 ${Math.floor(THEME_PACKAGE_MAX_BYTES / 1024)}KB`, { tone: "danger" });
      return;
    }
    let decoded: ReturnType<typeof parseThemePackage>;
    try {
      decoded = parseThemePackage(await file.text());
    } catch (error) {
      await dialogs.confirm({
        title: "主题 JSON 无法导入",
        message: message(error),
        confirmLabel: "知道了",
        cancelLabel: "关闭"
      });
      return;
    }

    const activeBefore = theme.current().themeId;
    const existing = listThemes().find((item: any) => item.id === decoded.definition.id);
    const definitionBefore = existing ? serializableThemeDefinition(existing) : null;
    const appearanceBefore = existing ? {
      light: readSurfaceAppearance(existing.id, "light"),
      dark: readSurfaceAppearance(existing.id, "dark")
    } : null;

    try {
      registerTheme(decoded.definition, {
        replace: true,
        archiveManaged: true,
        removable: true,
        user: true,
        forceBuiltinChange: true
      });
      replaceThemeAppearance(decoded.definition.id, decoded.appearance);
      theme.activateTheme(decoded.definition.id);
      applySurfaceAppearance();
      await theme.unmarkThemeRemoved(decoded.definition.id);
      toast(
        existing
          ? `已更新并应用「${decoded.definition.label}」（同 ID 主题已被替换）`
          : `已导入并应用「${decoded.definition.label}」`,
        { tone: "ok" }
      );
      clearAppearanceOverride();
      refresh();
    } catch (error) {
      try {
        if (definitionBefore) {
          registerTheme(definitionBefore, {
            replace: true,
            archiveManaged: true,
            removable: existing?.removable === true,
            user: existing?.user === true,
            forceBuiltinChange: true
          });
          if (appearanceBefore) replaceThemeAppearance(definitionBefore.id, appearanceBefore);
        } else {
          unregisterTheme(decoded.definition.id, { force: true });
          removeThemeAppearance(decoded.definition.id);
        }
        if (listThemes().some((item: any) => item.id === activeBefore)) theme.activateTheme(activeBefore);
        applySurfaceAppearance();
      } catch (rollbackError) {
        console.error("[Clawbox Theme] 主题 JSON 导入回滚失败", rollbackError);
      }
      toast(`主题导入失败：${message(error)}`, { tone: "danger" });
    }
  }

  async function chooseThemeJson(): Promise<void> {
    await importThemeJson(await chooseFile(".json,application/json"));
  }

  async function exportThemeJson(): Promise<void> {
    const current = listThemes().find((item: any) => item.id === theme.current().themeId);
    if (!current) {
      toast("当前主题不存在，无法导出", { tone: "danger" });
      return;
    }
    stateBridge.patch({ themePackageBusy: true });
    try {
      const appearance = {
        light: readSurfaceAppearance(current.id, "light"),
        dark: readSurfaceAppearance(current.id, "dark")
      };
      const payload = createThemePackage(current, appearance);
      downloadThemePackage(serializeThemePackage(payload), themePackageFilename(current));
      toast(`已导出「${current.label}」主题 JSON`, { tone: "ok" });
    } catch (error) {
      toast(`主题 JSON 导出失败：${message(error)}`, { tone: "danger" });
    } finally {
      stateBridge.patch({ themePackageBusy: false });
    }
  }

  async function removeTheme(id: string): Promise<void> {
    const entry = listThemes().find((item: any) => item.id === id);
    if (!entry || (entry.removable !== true && entry.user !== true)) return;
    if (listThemes().length <= 1) {
      toast("至少保留一个主题，无法删除最后一个主题", { tone: "danger" });
      return;
    }
    const confirmed = await dialogs.confirm({
      title: "删除主题",
      message: `「${entry.label}」会从本机主题清单移除。之后可以重新导入对应 JSON 恢复。`,
      confirmLabel: "删除",
      danger: true
    });
    if (!confirmed) return;
    const wasActive = theme.current().themeId === id;
    removeUserThemeFile(id);
    try {
      unregisterTheme(id, { force: true });
    } catch (error) {
      toast(message(error), { tone: "danger" });
      return;
    }
    removeThemeAppearance(id);
    if (wasActive) {
      const remaining = listThemes();
      const fallback = remaining.find((item: any) => item.fixedScheme === theme.activeScheme) || remaining[0];
      if (fallback) theme.activateTheme(fallback.id);
    }
    try {
      await theme.markThemeRemoved(id);
      toast("主题已删除", { tone: "ok" });
    } catch (error) {
      toast(`主题已从当前会话移除，但主题清单保存失败：${message(error)}`, { tone: "danger" });
    }
    clearAppearanceOverride();
    refresh();
  }

  return {
    setAppearanceMode,
    activateTheme,
    setContrast,
    setTransparent,
    chooseThemeJson,
    exportThemeJson,
    removeTheme
  };
}
