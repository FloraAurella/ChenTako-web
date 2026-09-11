import { normalizeChatConfig } from "../../context/public/domain_config.js";
import { createId } from "../../../contracts/normalize.js";

export function projectName(value) {
  return String(value ?? "").trim().slice(0, 60);
}

export function normalizeProjects(value) {
  const seen = new Set();
  return (Array.isArray(value) ? value : []).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const name = projectName(raw.name);
    if (!name) return [];
    const id = String(raw.id || createId());
    if (seen.has(id)) return [];
    seen.add(id);
    return [{ id, name, configOverrides: normalizeChatConfig(raw.configOverrides, true), createdAt: Number(raw.createdAt) > 0 ? Number(raw.createdAt) : Date.now() }];
  }).sort((a, b) => a.createdAt - b.createdAt);
}

export function normalizeProjectSidebar(value = {}) {
  const strings = (list) => Array.isArray(list) ? [...new Set(list.filter((item) => typeof item === "string"))] : [];
  return {
    collapsedSections: strings(value?.collapsedSections).filter((key) => key === "projects" || key === "chats"),
    collapsedProjectIds: strings(value?.collapsedProjectIds)
  };
}
