import { Scope } from "../../core/scope";
import { themeArtworkBackground } from "../../resources/artworks/index.js";
"use strict";

/**
 * 主题控制器：解析外观偏好（含旧主题 ID 迁移）→ 把令牌写入
 * documentElement CSS 变量 → 同步 data-theme / data-scheme / theme-color，
 * 对外发布 ai-chatbox:themechange 与 window.AiChatboxThemeAPI，同时保留旧别名。
 */

import { THEME_API_VERSION, SUPPORTED_THEME_TOKENS, validateThemeDefinition } from "./domain/contract.js";
import { LIGHT_TOKENS, themeFaviconDataUri } from "./domain/base-themes.js";
import {
  registerTheme,
  listThemes,
  getTheme,
  subscribeThemeRegistry,
  unregisterTheme,
  getBuiltInThemeDefinitions
} from "./domain/registry.js";
import { loadCustomThemes } from "./domain/load-custom.js";
import {
  buildUserThemeDefinition,
  clearUserThemeFiles,
  listUserThemeFiles,
  restoreUserThemes
} from "./domain/user-theme.js";
import { createThemeArchiveStore, themeArchiveLocation, THEME_ARCHIVE_KIND, THEME_ARCHIVE_VERSION } from "./domain/archive.js";
import { resolveSeedAdditions, withRemovedId, withoutRemovedId, normalizeRemovedIds, filterRetiredArchiveFiles } from "./domain/seed.js";
import { readUiPreferences, writeUiPreferences } from "./services/preferences.js";
import { applySurfaceAppearance } from "./surface.js";

const APPEARANCE_MODES = ["system", "light", "dark"];
const DEFAULT_THEME_ID = "tako-festival";
const RETIRED_THEME_IDS = Object.freeze([
  "everforest",
  "embroidered-starlight",
  "seaside",
  "juicy-pear",
  "night-orchard",
  "argenteuil",
  "seine-morning"
]);

// 旧主题包可能保存过已经下线的展示文案；主题 ID 继续兼容，但显示名和说明统一迁移。
const BUILTIN_PRESENTATION = {
  "juicy-pear": {
    label: "晨光 · Daybreak",
    note: "暖白纸面与清晰身份色，适合白天工作",
    captions: { light: "DAYBREAK · LIGHT", dark: "DAYBREAK · LIGHT" }
  },
  "night-orchard": {
    label: "月影 · Midnight",
    note: "深色画布与柔和身份色，适合夜间工作",
    captions: { light: "MIDNIGHT · DARK", dark: "MIDNIGHT · DARK" }
  }
};

/** 旧版多主题 ID → 浅色 / 深色基础主题映射。 */
const LEGACY_THEME_MAP = {
  everforest: { themeId: DEFAULT_THEME_ID, mode: "light" },
  "embroidered-starlight": { themeId: DEFAULT_THEME_ID, mode: "light" },
  seaside: { themeId: DEFAULT_THEME_ID, mode: "light" },
  cream: { themeId: DEFAULT_THEME_ID, mode: "light" },
  "cream-night": { themeId: DEFAULT_THEME_ID, mode: "dark" },
  sea: { themeId: DEFAULT_THEME_ID, mode: "light" },
  "sea-night": { themeId: DEFAULT_THEME_ID, mode: "dark" },
  forest: { themeId: DEFAULT_THEME_ID, mode: "light" },
  "forest-night": { themeId: DEFAULT_THEME_ID, mode: "dark" },
  "tropical-sticker": { themeId: DEFAULT_THEME_ID, mode: "light" },
  "paper-light": { themeId: DEFAULT_THEME_ID, mode: "light" },
  "paper-dark": { themeId: DEFAULT_THEME_ID, mode: "dark" },
  "juicy-pear": { themeId: DEFAULT_THEME_ID, mode: "light" },
  "night-orchard": { themeId: DEFAULT_THEME_ID, mode: "dark" },
  argenteuil: { themeId: DEFAULT_THEME_ID, mode: "light" },
  "seine-morning": { themeId: DEFAULT_THEME_ID, mode: "light" }
};

export function migrateLegacyThemePrefs(prefs) {
  const migrated = {
    themeId: prefs.themeId || "",
    appearanceMode: APPEARANCE_MODES.includes(prefs.appearanceMode) ? prefs.appearanceMode : "system"
  };
  // 已存储但已退役的主题 ID（纸本两套）也映射到基础主题。
  if (migrated.themeId && LEGACY_THEME_MAP[migrated.themeId.toLowerCase()]) {
    migrated.themeId = LEGACY_THEME_MAP[migrated.themeId.toLowerCase()].themeId;
  }
  const legacyFamily = String(prefs.legacyThemeFamily || "").toLowerCase();
  if (legacyFamily && !migrated.themeId) {
    const known = LEGACY_THEME_MAP[legacyFamily] || (
      legacyFamily.endsWith("-night")
        ? { themeId: DEFAULT_THEME_ID, mode: "dark" }
        : { themeId: DEFAULT_THEME_ID, mode: "light" }
    );
    migrated.themeId = known.themeId;
    // 旧 appearanceMode 语义保留：显式 light/dark 优先于主题自带的明暗；
    // "system" 与缺失都视为未显式设置，回落旧场景自带的明暗（新双态默认主题不再靠
    // fixedScheme 锁死，明暗完全由 appearanceMode 决定，因此这里必须落到具体档位）。
    if (prefs.appearanceMode !== "light" && prefs.appearanceMode !== "dark") {
      migrated.appearanceMode = known.mode;
    }
  }
  return migrated;
}

export function createThemeController() {
  const scope = new Scope();
  let installedApi = null;
  const doc = typeof document !== "undefined" ? document : null;
  scope.defer(() => doc?.documentElement.style.removeProperty("--theme-artwork"));
  const listeners = new Set();
  let prefs = { themeId: "", appearanceMode: "system", drawerCollapsed: false };
  let activeThemeId = DEFAULT_THEME_ID;
  let activeScheme = "light";
  let archiveReady = false;
  let archiveLocation = themeArchiveLocation();
  let archiveWriteChain = Promise.resolve();
  let archivePresentationChanged = false;
  let archiveRemovedIds = [];
  const archiveStore = createThemeArchiveStore();

  const media = doc && typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

  function systemScheme() {
    return media && media.matches ? "dark" : "light";
  }

  function resolvedScheme() {
    if (prefs.appearanceMode === "system") return systemScheme();
    return prefs.appearanceMode === "dark" ? "dark" : "light";
  }

  function fallbackTheme(scheme) {
    return getTheme(DEFAULT_THEME_ID)
      || listThemes().find((theme) => theme.fixedScheme === scheme)
      || listThemes()[0];
  }

  function detail() {
    return {
      themeId: activeThemeId,
      scheme: activeScheme,
      appearanceMode: prefs.appearanceMode,
      apiVersion: THEME_API_VERSION
    };
  }

  function publish() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("ai-chatbox:themechange", { detail: detail() }));
      window.dispatchEvent(new CustomEvent("clawbox:themechange", { detail: detail() }));
    }
    for (const listener of listeners) {
      try {
        listener(detail());
      } catch (error) {
        console.error("[ChenTako Theme] listener error", error);
      }
    }
  }

  function applyTheme(themeId, { silent = false } = {}) {
    if (!doc) return;
    const theme = getTheme(themeId) || fallbackTheme(resolvedScheme());
    if (!theme) return;
    const scheme = theme.fixedScheme || resolvedScheme();
    activeThemeId = theme.id;
    activeScheme = scheme;

    const root = doc.documentElement;
    for (const token of SUPPORTED_THEME_TOKENS) {
      root.style.removeProperty(token);
    }
    // 未覆盖的令牌回落到 tokens.css 样式表基线（按 data-scheme 取浅/深）；
    // 某一方案留空时不能借用另一方案的覆盖值。
    const tokens = theme.tokens[scheme] || {};
    for (const [token, value] of Object.entries(tokens)) {
      root.style.setProperty(token, value);
    }

    root.dataset.theme = theme.id;
    root.dataset.themeBase = theme.fixedScheme || theme.id;
    root.dataset.scheme = scheme;
    root.style.setProperty("--theme-artwork", themeArtworkBackground(theme.id, scheme));

    let meta = doc.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = doc.createElement("meta");
      meta.setAttribute("name", "theme-color");
      doc.head.appendChild(meta);
    }
    const canvasMid = tokens["--canvas-mid"] || getComputedStyle(doc.documentElement)
      .getPropertyValue("--canvas-mid").trim() || LIGHT_TOKENS["--canvas-mid"];
    meta.setAttribute("content", String(canvasMid));

    // 品牌 favicon 跟随当前主题身份色（HTML 静态 href 仅作首帧回退）
    const favicon = doc.querySelector('link[rel="icon"]');
    if (favicon) {
      favicon.setAttribute("href", themeFaviconDataUri(
        tokens["--pear"] || tokens["--brand-logo"]
      ));
    }

    // 画作独立于纯色基底；对比度与透景材质在主题令牌就位后统一派生。
    applySurfaceAppearance(doc);

    if (!silent) publish();
  }

  function persistPrefs() {
    writeUiPreferences({ ...prefs });
  }

  function refresh({ silent = false } = {}) {
    const registered = prefs.themeId ? getTheme(prefs.themeId) : null;
    if (registered) {
      applyTheme(registered.id, { silent });
      return;
    }
    const fallback = fallbackTheme(resolvedScheme());
    if (fallback) applyTheme(fallback.id, { silent });
  }

  function init({ quiet = false } = {}) {
    prefs = migrateLegacyThemePrefs(readUiPreferences());
    if (prefs.themeId && !getTheme(prefs.themeId)) {
      prefs.themeId = "";
    }
    refresh({ silent: quiet });
    if (!quiet) publish();
  }

  function setAppearanceMode(mode) {
    if (!APPEARANCE_MODES.includes(mode)) return;
    prefs.appearanceMode = mode;
    if (getTheme(prefs.themeId) && getTheme(prefs.themeId).fixedScheme) {
      // 内置基础主题随外观模式成对轮换，显式主题 ID 让位。
      prefs.themeId = "";
    }
    persistPrefs();
    refresh();
  }

  function activateTheme(id) {
    const theme = getTheme(id);
    if (!theme) return false;
    prefs.themeId = theme.id;
    if (theme.fixedScheme) prefs.appearanceMode = theme.fixedScheme;
    persistPrefs();
    applyTheme(theme.id);
    return true;
  }

  /** 快速换肤：轮换全部已注册主题。 */
  function cycleFamily() {
    const themes = listThemes();
    if (!themes.length) return;
    const index = themes.findIndex((theme) => theme.id === activeThemeId);
    const next = themes[(index + 1 + themes.length) % themes.length];
    activateTheme(next.id);
  }

  function serializableDefinition(theme) {
    return {
      id: theme.id,
      label: theme.label,
      note: theme.note || "",
      ...(theme.baseTheme ? { baseTheme: theme.baseTheme } : {}),
      preview: { ...(theme.preview || {}) },
      captions: { ...(theme.captions || {}) },
      tokens: {
        light: { ...((theme.tokens && theme.tokens.light) || {}) },
        dark: { ...((theme.tokens && theme.tokens.dark) || {}) }
      },
      ...(theme.typefaces ? { typefaces: { ...theme.typefaces } } : {}),
      fixedScheme: theme.fixedScheme || "",
      replace: false
    };
  }

  function buildArchiveFiles() {
    const legacyFiles = new Map(listUserThemeFiles().map((entry) => [entry.id, entry]));
    return listThemes().map((theme) => {
      const legacy = legacyFiles.get(theme.id);
      return {
        path: `themes/${theme.id}.theme.json`,
        id: theme.id,
        source: legacy ? "user" : theme.sourceCustom ? "source" : (theme.user ? "user" : "built-in"),
        savedAt: legacy && Number.isFinite(legacy.savedAt) ? legacy.savedAt : 0,
        raw: legacy ? legacy.raw : null,
        definition: serializableDefinition(theme)
      };
    });
  }

  function legacyUserArchiveFile(entry) {
    if (!entry || typeof entry !== "object" || !entry.id || !entry.raw) return null;
    const parsed = buildUserThemeDefinition(entry.raw);
    if (parsed.errors.length || !parsed.definition) return null;
    return {
      path: `themes/${parsed.definition.id}.theme.json`,
      id: parsed.definition.id,
      source: "user",
      savedAt: Number.isFinite(entry.savedAt) ? entry.savedAt : 0,
      raw: entry.raw,
      definition: serializableDefinition(parsed.definition)
    };
  }

  function archivePayload(files) {
    return {
      kind: THEME_ARCHIVE_KIND,
      version: THEME_ARCHIVE_VERSION,
      savedAt: Date.now(),
      removedIds: archiveRemovedIds,
      files
    };
  }

  function restoreArchiveFile(file) {
    if (!file || typeof file !== "object") return null;
    let definition = file.definition;
    let isUser = file.source === "user";
    if (file.raw && typeof file.raw === "object") {
      const parsed = buildUserThemeDefinition(file.raw);
      if (!parsed.errors.length && parsed.definition) {
        definition = parsed.definition;
        isUser = true;
      }
    }
    const presentation = file.source === "built-in" ? BUILTIN_PRESENTATION[definition && definition.id] : null;
    if (presentation && (
      definition.label !== presentation.label ||
      definition.note !== presentation.note ||
      JSON.stringify(definition.captions || {}) !== JSON.stringify(presentation.captions)
    )) {
      definition = { ...definition, ...presentation };
      archivePresentationChanged = true;
    }
    // 旧主题档案可能仍带 motion；新运行时只恢复声明式主题数据。
    if (definition && typeof definition === "object" && "motion" in definition) {
      const { motion: _archivedMotion, ...withoutMotion } = definition;
      definition = withoutMotion;
      archivePresentationChanged = true;
    }
    const errors = validateThemeDefinition(definition);
    if (errors.length) {
      console.warn(`[ChenTako Theme] 主题包文件 ${String(file.path || file.id || "(unknown)")} 无法恢复：${errors.join("；")}`);
      return null;
    }
    return {
      definition,
      user: isUser
    };
  }

  function installArchiveFiles(files) {
    // 主题包是权威清单：包中删除的默认主题也必须从内存注册表移除。
    for (const theme of listThemes()) unregisterTheme(theme.id, { force: true });
    const restored = [];
    const seen = new Set();
    for (const file of files) {
      const result = restoreArchiveFile(file);
      if (!result || seen.has(result.definition.id)) continue;
      seen.add(result.definition.id);
      registerTheme(result.definition, {
        replace: true,
        builtin: false,
        archiveManaged: true,
        removable: true,
        user: result.user,
        sourceCustom: file.source === "source",
        forceBuiltinChange: true
      });
      restored.push(result.definition.id);
    }
    return restored;
  }

  async function persistThemeArchive({ force = false } = {}) {
    if (!force && !archiveReady) return archiveLocation;
    const task = archiveWriteChain.then(async () => {
      archiveLocation = await archiveStore.save(archivePayload(buildArchiveFiles()));
      return archiveLocation;
    });
    archiveWriteChain = task.catch((error) => {
      console.warn("[ChenTako Theme] 主题包保存失败", error);
    });
    return task;
  }

  /** 主题被删除：记入 removedIds 墓碑，种子主题删除后不再复活。 */
  function markThemeRemoved(id) {
    archiveRemovedIds = withRemovedId(archiveRemovedIds, id);
    archiveReady = true;
    return persistThemeArchive({ force: true });
  }

  /** 主题被（重新）导入：同 ID 主题重新引入时清除墓碑。 */
  function unmarkThemeRemoved(id) {
    archiveRemovedIds = withoutRemovedId(archiveRemovedIds, id);
    archiveReady = true;
    return persistThemeArchive({ force: true });
  }

  /** 启动时读取主题包；没有主题包时把现有内置/自定义主题迁入包。 */
  async function loadThemeArchive() {
    archivePresentationChanged = false;
    // 种子主题（内置 / 源码自定义）要在 installArchiveFiles 清空注册表前快照：
    // 已删除的种子主题由 removedIds 墓碑挡住，不会再复活。
    const seedThemes = listThemes().filter((theme) => (
      theme.builtin === true || theme.sourceCustom === true
    ));
    let loaded;
    try {
      loaded = await archiveStore.load();
    } catch (error) {
      console.warn("[ChenTako Theme] 主题包存储不可用，继续使用内存主题", error);
      loaded = { payload: null, location: archiveLocation };
    }
    archiveLocation = loaded.location || archiveLocation;
    if (loaded.payload && Array.isArray(loaded.payload.files)) {
      archiveRemovedIds = normalizeRemovedIds(loaded.payload.removedIds);
      
      // 自动迁移：将旧主题 ID 加入 removedIds（如果尚未存在）
      let migratedRemovedIds = false;
      for (const oldId of RETIRED_THEME_IDS) {
        if (!archiveRemovedIds.includes(oldId)) {
          archiveRemovedIds = withRemovedId(archiveRemovedIds, oldId);
          migratedRemovedIds = true;
        }
      }

      // 已退役主题：档案中残留的文件（旧版本种子/旧用户主题升级前留下的）一律不装回，
      // 墓碑只防补种不够；用户重新导入同 ID 主题包时会先清除墓碑再登记。
      const tombstoneSet = new Set(archiveRemovedIds);
      const prunedResult = filterRetiredArchiveFiles(loaded.payload.files, archiveRemovedIds);
      const archiveFiles = prunedResult.files;
      const prunedRetired = prunedResult.pruned;

      let legacyChanged = false;
      const archiveIndex = new Map(archiveFiles.map((file, index) => [file.id, index]));
      for (const entry of listUserThemeFiles()) {
        const legacyFile = legacyUserArchiveFile(entry);
        if (!legacyFile) continue;
        // 墓碑中的主题不让旧主题存储重新合并复活（合并不成功会在迁移收尾统一清理）
        if (tombstoneSet.has(legacyFile.id)) {
          legacyChanged = true;
          continue;
        }
        const existingIndex = archiveIndex.get(legacyFile.id);
        const existing = existingIndex === undefined ? null : archiveFiles[existingIndex];
        if (!existing || Number(legacyFile.savedAt || 0) > Number(existing.savedAt || 0)) {
          if (existingIndex === undefined) {
            archiveIndex.set(legacyFile.id, archiveFiles.length);
            archiveFiles.push(legacyFile);
          } else {
            archiveFiles[existingIndex] = legacyFile;
          }
          legacyChanged = true;
        }
      }

      // 源码主题（sourceCustom / built-in）的定义以当前源码为准：档案只保存过旧版种子
      // 随应用发布的主题定义升级时刷新文件；用户导入/更新的版本（source=user）不动。
      const seedById = new Map(seedThemes.map((theme) => [theme.id, theme]));
      let sourceRefreshed = false;
      for (let index = 0; index < archiveFiles.length; index += 1) {
        const file = archiveFiles[index];
        if (!file || !file.id || file.source === "user") continue;
        const seed = seedById.get(file.id);
        if (!seed) continue;
        const currentDefinition = serializableDefinition(seed);
        if (JSON.stringify(currentDefinition) !== JSON.stringify(file.definition || {})) {
          archiveFiles[index] = { ...file, raw: null, definition: currentDefinition };
          sourceRefreshed = true;
        }
      }

      // 档案是唯一真源：只补种"档案从未见过且未被用户删除"的源码/内置主题，
      // 档案已有的同 ID 一律以档案为准（用户更新、删除都持久）。
      const additions = resolveSeedAdditions(seedThemes, archiveFiles, archiveRemovedIds);
      const additionFiles = additions.map((theme) => ({
        path: `themes/${theme.id}.theme.json`,
        id: theme.id,
        source: theme.sourceCustom ? "source" : "built-in",
        savedAt: 0,
        raw: null,
        definition: serializableDefinition(theme)
      }));
      const restored = installArchiveFiles([...archiveFiles, ...additionFiles]);
      if (restored.length) {
        archiveReady = true;
        const archiveChanged = additions.length > 0 || legacyChanged || archivePresentationChanged
          || migratedRemovedIds || prunedRetired || sourceRefreshed;
        let archivePersisted = !archiveChanged;
        if (archiveChanged) {
          try {
            await persistThemeArchive({ force: true });
            archivePersisted = true;
          } catch (error) {
            console.warn("[ChenTako Theme] 种子主题写入主题包失败", error);
          }
        }
        if (archivePersisted) clearUserThemeFiles();
        return restored;
      }
    }

    // 首启（或主题包损坏/为空）：当前注册表（内置 + 源码）整体作为种子迁入，
    // 从此档案成为唯一真源。
    // 已退役主题自动加入 removedIds，防止用户旧档案复活。
    archiveRemovedIds = [...RETIRED_THEME_IDS];
    const available = listThemes().filter(theme => !RETIRED_THEME_IDS.includes(theme.id));
    const existing = available.length ? available : getBuiltInThemeDefinitions();
    const files = existing.map((theme) => ({
      path: `themes/${theme.id}.theme.json`,
      id: theme.id,
      source: theme.sourceCustom ? "source" : (theme.user ? "user" : "built-in"),
      raw: null,
      definition: serializableDefinition(theme)
    }));
    const restored = installArchiveFiles(files.length ? files : getBuiltInThemeDefinitions().map((theme) => ({
      path: `themes/${theme.id}.theme.json`,
      id: theme.id,
      source: "built-in",
      raw: null,
      definition: theme
    })));
    archiveReady = true;
    try {
      await persistThemeArchive({ force: true });
      clearUserThemeFiles();
    } catch (error) {
      console.warn("[ChenTako Theme] 首次主题包迁移失败，保留兼容存储", error);
    }
    return restored;
  }

  function current() {
    return detail();
  }

  // 系统明暗变化：仅 system 模式下跟随。
  if (media) {
    const onChange = () => {
      if (prefs.appearanceMode === "system") refresh();
    };
    if (typeof media.addEventListener === "function") scope.listen(media, "change", onChange);
    else if (typeof media.addListener === "function") { media.addListener(onChange); scope.defer(() => media.removeListener(onChange)); }
  }

  // 自定义主题注册后自动恢复已保存的主题 ID。
  scope.defer(subscribeThemeRegistry(() => {
    if (prefs.themeId && prefs.themeId === activeThemeId) return;
    if (prefs.themeId && getTheme(prefs.themeId) && getTheme(prefs.themeId).id !== activeThemeId) {
      refresh();
    }
  }));

  function installPublicApi() {
    if (typeof window === "undefined") return;
    window.AiChatboxThemeAPI = window.ClawboxThemeAPI = installedApi = Object.freeze({
      version: THEME_API_VERSION,
      validate: (definition) => validateThemeDefinition(definition),
      register(definition, options = {}) {
        const errors = validateThemeDefinition(definition);
        if (errors.length) throw new Error(errors.join("；"));
        registerTheme(definition, { replace: options.replace === true });
        if (options.activate) activateTheme(definition.id);
        return true;
      },
      list: () => listThemes().map((theme) => ({ ...theme })),
      get: (id) => {
        const theme = getTheme(id);
        return theme ? { ...theme } : null;
      },
      activate: (id) => activateTheme(id),
      setAppearance(mode) {
        setAppearanceMode(mode);
        return current();
      },
      current,
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }
    });
  }

  return {
    dispose() { scope.dispose(); listeners.clear(); if (typeof window !== "undefined" && window.ClawboxThemeAPI === installedApi) delete window.ClawboxThemeAPI; if (typeof window !== "undefined" && window.AiChatboxThemeAPI === installedApi) delete window.AiChatboxThemeAPI; },
    init,
    applyTheme,
    setAppearanceMode,
    activateTheme,
    cycleFamily,
    current,
    refresh,
    installPublicApi,
    loadThemeArchive,
    persistThemeArchive,
    markThemeRemoved,
    unmarkThemeRemoved,
    get themeArchiveLocation() { return archiveLocation; },
    loadCustomThemes,
    restoreUserThemes,
    get prefs() { return { ...prefs }; },
    get activeThemeId() { return activeThemeId; },
    get activeScheme() { return activeScheme; }
  };
}
