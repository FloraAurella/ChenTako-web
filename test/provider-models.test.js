"use strict";

import { describe, expect, it } from "vitest";
import {
  formatTokenLimit,
  normalizeModelOverrides,
  resolveEffectiveModelConfig,
  snapshotProviderForModel
} from "../src/modules/connections/domain/models.js";

function provider(overrides = {}) {
  return {
    displayName: "测试供应商",
    baseUrl: "https://api.example.com/v1",
    responseFormat: "responses",
    defaultModel: "test-1",
    models: ["test-1", "test-2"],
    contextWindow: 131072,
    maxTokens: 8192,
    temperature: 0.7,
    topP: 1,
    defaultReasoningEffort: "low",
    modelOverrides: {},
    modelCapabilities: {},
    ...overrides
  };
}

describe("模型配置继承", () => {
  it("没有覆盖时返回供应商默认值与 provider 来源", () => {
    const resolved = resolveEffectiveModelConfig(provider(), "test-1");

    expect(resolved).toMatchObject({
      contextWindow: 131072,
      maxTokens: 8192,
      temperature: 0.7,
      topP: 1,
      defaultReasoningEffort: "low",
      visionInput: "auto",
      imageOutput: "auto",
      sources: {
        contextWindow: "provider",
        maxTokens: "provider",
        temperature: "provider",
        topP: "provider",
        defaultReasoningEffort: "provider"
      }
    });
  });

  it("稀疏模型覆盖优先，未覆盖字段继续继承", () => {
    const resolved = resolveEffectiveModelConfig(provider({
      modelOverrides: {
        "test-2": { maxTokens: 2048, temperature: 0, defaultReasoningEffort: "high" }
      },
      modelCapabilities: {
        "test-2": { visionInput: false, imageOutput: true }
      }
    }), "test-2");

    expect(resolved).toMatchObject({
      contextWindow: 131072,
      maxTokens: 2048,
      temperature: 0,
      topP: 1,
      defaultReasoningEffort: "high",
      visionInput: false,
      imageOutput: true,
      sources: {
        contextWindow: "provider",
        maxTokens: "model",
        temperature: "model",
        topP: "provider",
        defaultReasoningEffort: "model"
      }
    });
  });

  it("归一化时过滤孤立模型、非法值和未知字段", () => {
    expect(normalizeModelOverrides({
      "test-1": {
        contextWindow: "262144",
        maxTokens: -1,
        temperature: 2.5,
        topP: 0.8,
        defaultReasoningEffort: "medium",
        unknown: true
      },
      orphan: { maxTokens: 1024 }
    }, ["test-1"])).toEqual({
      "test-1": {
        contextWindow: 262144,
        topP: 0.8,
        defaultReasoningEffort: "medium"
      }
    });
  });

  it("会话快照写入当前模型的生效额度而不是供应商默认额度", () => {
    const snapshot = snapshotProviderForModel(provider({
      modelOverrides: { "test-2": { contextWindow: 1000000, maxTokens: 16384 } }
    }), "test-2");

    expect(snapshot.contextWindow).toBe(1000000);
    expect(snapshot.maxTokens).toBe(16384);
    expect(snapshot).not.toHaveProperty("modelOverrides");
  });
});

describe("模型额度摘要", () => {
  it("以紧凑格式显示 K 与 M", () => {
    expect(formatTokenLimit(2048)).toBe("2K");
    expect(formatTokenLimit(131072)).toBe("131.1K");
    expect(formatTokenLimit(1000000)).toBe("1M");
  });
});
