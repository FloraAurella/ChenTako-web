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

describe('上下文一级配置自动保存', () => {
  it('连续输入期间保留最新草稿，串行写入后刷新原始基线', async () => {
    let finish!: (value: boolean) => void;
    const persist = vi.fn().mockImplementationOnce(() => new Promise<boolean>(resolve => { finish = resolve; })).mockResolvedValue(true);
    const { service, bridge, store } = fixture(persist); service.begin();
    service.setField('systemPrompt', 'first'); const first = service.save();
    service.setField('systemPrompt', 'second'); const second = service.save();
    expect(persist).toHaveBeenCalledTimes(1); finish(true);
    await first; expect(bridge.get().contextEditing?.values.systemPrompt).toBe('second');
    await second; expect(store.state.chatConfig.systemPrompt).toBe('second');
    expect(bridge.get().contextEditing?.dirty).toBe(false); service.releaseEditor();
  });
  it('中文组合输入不提交中间拼音，完成输入自动提交', async () => {
    vi.useFakeTimers();
    const { service, store } = fixture(); service.begin();
    try {
      service.setComposing(true); service.setField('systemPrompt', 'zhong');
      await vi.advanceTimersByTimeAsync(500); expect(store.persist).not.toHaveBeenCalled();
      service.setField('systemPrompt', '中文'); service.setComposing(false);
      await vi.advanceTimersByTimeAsync(320); expect(store.state.chatConfig.systemPrompt).toBe('中文');
    } finally { service.releaseEditor(); vi.useRealTimers(); }
  });
  it('切换作用范围前提交即时编辑，错误时阻止丢弃输入', async () => {
    const { service, store } = fixture(); service.begin();
    service.setField('systemPrompt', 'saved on navigation');
    expect(await service.beforeNavigate({ name: 'settings', settingsSection: 'context', settingsProjectId: 'p' })).toBe(true);
    expect(store.state.chatConfig.systemPrompt).toBe('saved on navigation');
    service.setField('temperature', '');
    expect(await service.beforeNavigate({ name: 'chat' })).toBe(false); service.releaseEditor();
  });
  it('卸载取消尚未开始的写入，迟到的本地保存不重新创建编辑态', async () => {
    vi.useFakeTimers();
    const { service, store, bridge } = fixture(); service.begin();
    try {
      service.setField('systemPrompt', 'pending'); service.releaseEditor();
      bridge.patch({ contextEditing: null }); await vi.advanceTimersByTimeAsync(500);
      expect(store.persist).not.toHaveBeenCalled(); expect(bridge.get().contextEditing).toBeNull();
    } finally { vi.useRealTimers(); }
  });
});
