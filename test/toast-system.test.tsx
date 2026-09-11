"use strict";

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InlineErrorLine } from "../src/shared/overlays/InlineErrorLine";
import {
  clearInlineError,
  inlineErrorStore,
  reportInlineFeedback
} from "../src/shared/overlays/inline-error-service";

const mounted: Array<{ container: HTMLDivElement; root: Root }> = [];

function render(node: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(node));
  mounted.push({ container, root });
  return container;
}

describe("页面内联错误系统", () => {
  beforeEach(() => {
    clearInlineError();
  });

  afterEach(() => {
    clearInlineError();
    for (const item of mounted.splice(0)) {
      act(() => item.root.unmount());
      item.container.remove();
    }
  });

  it("关闭普通与成功全局通知，只保留 danger 错误", () => {
    reportInlineFeedback("普通状态");
    reportInlineFeedback("保存成功", { tone: "ok" });
    expect(inlineErrorStore.getSnapshot()).toBeNull();

    reportInlineFeedback("保存失败", { tone: "danger" });
    expect(inlineErrorStore.getSnapshot()).toMatchObject({ message: "保存失败" });
    reportInlineFeedback("保存成功", { tone: "ok" });
    expect(inlineErrorStore.getSnapshot()).toBeNull();
  });

  it("错误进入单一状态槽且不会启动自动消失定时器", () => {
    const listener = vi.fn();
    const unsubscribe = inlineErrorStore.subscribe(listener);

    reportInlineFeedback("错误文字", { tone: "danger" });
    const snapshot = inlineErrorStore.getSnapshot();
    expect(snapshot).not.toBeNull();
    expect(listener).toHaveBeenCalled();
    expect(snapshot?.message).toBe("错误文字");
    unsubscribe();
  });

  it("直接渲染红色可关闭错误文字，不创建 toast 卡片", () => {
    const container = render(<InlineErrorLine className="test-error" />);
    act(() => reportInlineFeedback("连接失败，请检查地址", { tone: "danger" }));

    const error = container.querySelector<HTMLElement>("[role='alert']");
    expect(error?.textContent).toContain("连接失败，请检查地址");
    expect(error?.classList.contains("inline-error-line")).toBe(true);
    expect(container.querySelector(".toast-note")).toBeNull();

    act(() => container.querySelector<HTMLButtonElement>("[aria-label='关闭错误信息']")?.click());
    expect(container.querySelector("[role='alert']")).toBeNull();
  });
});
