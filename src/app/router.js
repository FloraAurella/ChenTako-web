


export function parseRoute(hash, fallbackSection, SETTINGS_SECTIONS) {
  const DEFAULT_SETTINGS_SECTION = SETTINGS_SECTIONS.includes("providers") ? "providers" : SETTINGS_SECTIONS[0];
  const value = String(hash || "").replace(/^#\/?/, "");
  const parts = value.split("/").filter(Boolean);
  const requestedSection = parts[1] === "extensions" ? "tools" : parts[1] === "changelog" ? "about" : parts[1];
  const fallback = SETTINGS_SECTIONS.includes(fallbackSection) && fallbackSection !== "appearance"
    ? fallbackSection
    : DEFAULT_SETTINGS_SECTION;
  const isSettings = parts[0] === "settings";
  const hasKnownSection = SETTINGS_SECTIONS.includes(requestedSection);
  const section = isSettings ? (hasKnownSection ? requestedSection : DEFAULT_SETTINGS_SECTION) : fallback;
  const settingsProviderId = isSettings && requestedSection === "providers" && parts[2]
    ? decodeURIComponent(parts.slice(2).join("/"))
    : "";
  if (isSettings) {
    return {
      name: "settings",
      settingsSection: section,
      settingsProviderId,
      settingsProjectId: requestedSection === "context" && parts[2] ? decodeURIComponent(parts[2]) : "",
      // 一级目录使用不带 section 的 hash；带合法 section 才是二级详情。
      settingsDetail: hasKnownSection
    };
  }
  return { name: "chat", settingsSection: fallback, settingsDetail: false, settingsProviderId: "" };
}

export function routeToHash(route) {
  if (route.name === "settings") {
    if (route.settingsDetail === false) return "#/settings";
    const providerSuffix = route.settingsSection === "providers" && route.settingsProviderId
      ? `/${encodeURIComponent(route.settingsProviderId)}`
      : "";
    const projectSuffix = route.settingsSection === "context" && route.settingsProjectId ? `/${encodeURIComponent(route.settingsProjectId)}` : "";
    return `#/settings/${route.settingsSection}${providerSuffix}${projectSuffix}`;
  }
  return "#/chat";
}

