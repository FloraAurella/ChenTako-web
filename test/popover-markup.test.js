import { describe, it, expect } from "vitest";
import { effortPanelMarkup, modelPanelMarkup } from "../src/modules/chat/services/popover-markup.js";

describe("runtime menu compatibility", () => {
  it("normalizes legacy and unknown effort consistently without mutating inputs", () => {
    for (const [key, index, label] of [["none", 0, "轻量"], ["unknown", 1, "中等"], ["xhigh", 3, "极高"]]) {
      const html = effortPanelMarkup(key, '<model "unsafe">', "high");
      expect(html).toContain(`aria-valuenow="${index}"`);
      expect(html).toContain(`aria-valuetext="${label}"`);
      expect(html).toContain("重置为：高");
      expect(html).not.toContain('<model "unsafe">');
    }
  });
  it("selects by provider and model and groups status without repeating protocol", () => {
    const provider = { id: "a", displayName: "MixedCase", models: ["same"], enabled: true, responseFormat: "openai-compatible", saveChats: false };
    const html = modelPanelMarkup([provider, { ...provider, id: "b" }, { ...provider, id: "hidden", enabled: false }], { providerId: "b", model: "same" });
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).not.toContain("不保存");
    expect(html).toContain("MixedCase");
    expect(html).not.toContain("openai-compatible");
    expect(html).not.toContain('data-provider-id="hidden"');
  });
  it("keeps empty provider and empty model guidance", () => {
    expect(modelPanelMarkup([], {})).toContain("data-goto-settings");
    expect(modelPanelMarkup([{ id: "empty", models: [], displayName: "Empty" }], {})).toContain("暂无模型");
  });
});
