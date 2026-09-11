"use strict";

import { EFFORT_LEVELS } from "../../../contracts/constants.js";

const MODEL_OVERRIDE_KEYS = [
  "contextWindow",
  "maxTokens",
  "temperature",
  "topP",
  "defaultReasoningEffort"
];

const VALID_EFFORTS = new Set(["", ...EFFORT_LEVELS.map((level) => level.key)]);

function capability(value) {
  return value === true ? true : value === false ? false : "auto";
}

export function normalizeModelOverrides(value, models = []) {
  const source = value && typeof value === "object" ? value : {};
  const result = {};
  for (const model of models) {
    const entry = source[model];
    if (!entry || typeof entry !== "object") continue;
    const normalized = {};
    const contextWindow = Number(entry.contextWindow);
    const maxTokens = Number(entry.maxTokens);
    const temperature = Number(entry.temperature);
    const topP = Number(entry.topP);
    const effort = String(entry.defaultReasoningEffort ?? "");
    if (Number.isFinite(contextWindow) && contextWindow > 0) normalized.contextWindow = Math.min(10000000, Math.floor(contextWindow));
    if (Number.isFinite(maxTokens) && maxTokens > 0) normalized.maxTokens = Math.min(1000000, Math.floor(maxTokens));
    if (Number.isFinite(temperature) && temperature >= 0 && temperature <= 2) normalized.temperature = temperature;
    if (Number.isFinite(topP) && topP >= 0 && topP <= 1) normalized.topP = topP;
    if (Object.prototype.hasOwnProperty.call(entry, "defaultReasoningEffort") && VALID_EFFORTS.has(effort)) {
      normalized.defaultReasoningEffort = effort;
    }
    if (Object.keys(normalized).length) result[model] = normalized;
  }
  return result;
}

export function resolveEffectiveModelConfig(provider, modelId) {
  const model = String(modelId || "");
  const override = provider?.modelOverrides?.[model] || {};
  const caps = provider?.modelCapabilities?.[model] || {};
  const inherited = (key) => !Object.prototype.hasOwnProperty.call(override, key);
  const value = (key, fallback) => inherited(key) ? fallback : override[key];
  return {
    contextWindow: Number(value("contextWindow", provider?.contextWindow)) || 131072,
    maxTokens: Number(value("maxTokens", provider?.maxTokens)) || 8192,
    temperature: Number(value("temperature", provider?.temperature)),
    topP: Number(value("topP", provider?.topP)),
    defaultReasoningEffort: String(value("defaultReasoningEffort", provider?.defaultReasoningEffort || "")),
    visionInput: capability(caps.visionInput),
    imageOutput: capability(caps.imageOutput),
    sources: Object.fromEntries(MODEL_OVERRIDE_KEYS.map((key) => [key, inherited(key) ? "provider" : "model"]))
  };
}

export function snapshotProviderForModel(provider, modelId) {
  const effective = resolveEffectiveModelConfig(provider, modelId);
  return {
    displayName: provider.displayName,
    baseUrl: provider.baseUrl,
    responseFormat: provider.responseFormat,
    defaultModel: provider.defaultModel,
    contextWindow: effective.contextWindow,
    maxTokens: effective.maxTokens
  };
}

export function formatTokenLimit(value) {
  const number = Math.max(0, Number(value) || 0);
  if (number >= 1000000) return `${Number((number / 1000000).toFixed(number % 1000000 ? 1 : 0))}M`;
  if (number >= 1000) return `${Number((number / 1000).toFixed(number % 1000 ? 1 : 0))}K`;
  return String(number);
}
