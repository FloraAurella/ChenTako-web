"use strict";

import { describe, expect, it } from "vitest";
import {
  createExtensionDraft,
  enabledExtensions,
  isSupportedExtensionUrl,
  normalizeExtensionSelection,
  normalizeExtensions,
  validateExtensionDraft
} from "../src/modules/extensions/domain/model.js";

const WEATHER_SCHEMA = {
  type: "object",
  properties: { city: { type: "string" } },
  required: ["city"]
};

describe("extensions registry", () => {
  it("归一化 Tool 与 Skill 声明并保留全局启用状态", () => {
    const registry = normalizeExtensions({
      tools: [{ id: "tool-1", name: "weather_lookup", description: "查询天气", endpoint: "https://tools.example.com/weather", inputSchema: WEATHER_SCHEMA, enabled: true }],
      skills: [{ id: "skill-1", name: "审查", description: "审查代码", instructions: "先找可复现的问题。", enabled: false }],
      sandbox: { enabled: true }
    });

    expect(registry.tools[0].inputSchema).toEqual(WEATHER_SCHEMA);
    expect(registry.skills[0].enabled).toBe(false);
    expect(registry.sandbox.enabled).toBe(true);
  });

  it("Chat 运行时只读取设置中的全局启用状态", () => {
    const registry = normalizeExtensions({
      tools: [
        { id: "tool-on", name: "weather_lookup", description: "查询天气", endpoint: "https://tools.example.com/weather", inputSchema: WEATHER_SCHEMA, enabled: true },
        { id: "tool-off", name: "calendar_lookup", description: "查询日历", endpoint: "https://tools.example.com/calendar", inputSchema: WEATHER_SCHEMA, enabled: false }
      ],
      skills: [{ id: "skill-on", name: "审查", description: "审查代码", instructions: "先找问题。", enabled: true }],
      sandbox: { enabled: true },
      codeInterpreter: { enabled: true }
    });

    const active = enabledExtensions(registry);
    expect(active.tools.map((item) => item.id)).toEqual(["tool-on"]);
    expect(active.skills.map((item) => item.id)).toEqual(["skill-on"]);
    expect(active.sandbox).toBe(true);
    expect(active.codeInterpreter).toBe(true);
    expect(active.tools.length + active.skills.length + Number(active.sandbox) + Number(active.codeInterpreter)).toBe(4);
  });

  it("会话选择去重、限制并过滤空 id", () => {
    expect(normalizeExtensionSelection({
      tools: ["a", "a", "", null],
      skills: ["s1"],
      sandbox: true
    })).toEqual({ tools: ["a"], skills: ["s1"], sandbox: true });
  });

  it("Tool 表单会拒绝不安全地址、无效名称和不合规 schema", () => {
    const draft = createExtensionDraft("tool");
    Object.assign(draft, {
      name: "weather lookup",
      description: "查询天气",
      endpoint: "http://tools.example.com/weather",
      inputSchema: WEATHER_SCHEMA
    });
    expect(validateExtensionDraft("tool", draft)).toContain("工具名称");
    draft.name = "weather_lookup";
    expect(validateExtensionDraft("tool", draft)).toContain("仅支持 HTTPS");
    draft.endpoint = "https://tools.example.com/weather";
    draft.inputSchema = { type: "array" };
    expect(validateExtensionDraft("tool", draft)).toContain("根节点");
    expect(normalizeExtensions({ tools: [draft] }).tools[0].inputSchema).toEqual({ type: "object", properties: {} });
  });

  it("工具地址只接受 HTTPS 或回环 HTTP", () => {
    expect(isSupportedExtensionUrl("https://tools.example.com/search")).toBe(true);
    expect(isSupportedExtensionUrl("http://127.0.0.1:3001/tool")).toBe(true);
    expect(isSupportedExtensionUrl("http://localhost:3001/tool")).toBe(true);
    expect(isSupportedExtensionUrl("http://example.com/tool")).toBe(false);
    expect(isSupportedExtensionUrl("file:///tmp/tool")).toBe(false);
  });
});
