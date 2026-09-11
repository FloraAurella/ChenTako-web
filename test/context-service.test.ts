import { describe, it, expect, vi } from "vitest";
import { createContextSettingsService } from "../src/modules/context/services/context-service";
import { createSettingsStateBridge } from "../src/contracts/settings";
import { CHAT_CONFIG_DEFAULTS } from "../src/modules/context/domain/config.js";
function fixture(persist = vi.fn().mockResolvedValue(true)) {
  const state = { chatConfig: { ...CHAT_CONFIG_DEFAULTS }, projects: [{ id: "p", configOverrides: {} }], modelCompatibility: {} };
  const store = { state, persist, notify: vi.fn() };
  const bridge = createSettingsStateBridge();
  const service = createContextSettingsService({ store, theme: {}, dialogs: { confirm: vi.fn().mockResolvedValue(false), prompt: vi.fn(), previewHtml: vi.fn() }, toast: vi.fn() }, bridge);
  return { store, bridge, service };
}
describe("上下文设置事务", () => {
  it("存储失败不发布新配置，保留草稿用于重试", async () => {
    const { store, bridge, service } = fixture(vi.fn().mockResolvedValue(false));
    service.begin(); service.setField("systemPrompt", "new"); await service.save();
    expect(store.state.chatConfig.systemPrompt).toBe("");
    expect(bridge.get().contextEditing?.values.systemPrompt).toBe("new");
    expect(bridge.get().contextEditing?.dirty).toBe(true);
    expect(bridge.get().contextEditing?.error).toContain("存储写入失败");
    expect(store.notify).not.toHaveBeenCalled();
  });
  it("项目空字符串是显式覆盖，保存不会物化其他继承字段", async () => {
    const { store, service } = fixture(); service.begin("p"); service.setField("systemPrompt", ""); await service.save();
    expect(store.state.projects[0].configOverrides).toEqual({ systemPrompt: "" });
    service.inherit("systemPrompt"); await service.save();
    expect(store.state.projects[0].configOverrides).toEqual({});
  });
  it("非法输入留在表单中，不写入存储", async () => {
    const { store, service, bridge } = fixture(); service.begin(); service.setField("temperature", ""); await service.save();
    expect(store.persist).not.toHaveBeenCalled(); expect(bridge.get().contextEditing?.error).not.toBe("");
  });
});
