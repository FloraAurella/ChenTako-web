"use strict";

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDialogManager } from "../src/shared/dialogs.js";
import { LIGHT_TOKENS } from "../src/modules/appearance/domain/base-themes.js";
import { DialogLayer } from "../src/shared/overlays/DialogLayer";

let reactRoot: ReturnType<typeof createRoot>;

describe("HTML 安全预览", () => {
  beforeEach(() => {
    document.body.innerHTML = '<button id="origin">预览</button><div id="modalHost"></div><div id="react-root"></div>';
    reactRoot = createRoot(document.getElementById("react-root")!);
    act(() => reactRoot.render(<DialogLayer />));
  });

  afterEach(() => act(() => reactRoot.unmount()));

  it("使用无权限 sandbox iframe 与禁止脚本、网络、表单的 CSP", () => {
    const dialogs = createDialogManager();
    act(() => { dialogs.previewHtml({ source: '<main id="demo">内容</main><script>alert(1)</script>' }); });

    const frame = document.querySelector<HTMLIFrameElement>(".html-preview-dialog iframe");
    expect(frame).not.toBeNull();
    expect(frame!.getAttribute("sandbox")).toBe("");
    expect(frame!.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(frame!.srcdoc).toContain("script-src 'none'");
    expect(frame!.srcdoc).toContain("connect-src 'none'");
    expect(frame!.srcdoc).toContain("form-action 'none'");
    expect(frame!.srcdoc).toContain("navigate-to 'none'");
    expect(frame!.srcdoc).toContain(`background:${LIGHT_TOKENS["--surface-content"]}`);
    expect(frame!.srcdoc).toContain('<main id="demo">内容</main>');
  });

  it("Esc 关闭并把焦点还给预览触发按钮", async () => {
    const origin = document.getElementById("origin")!;
    origin.focus();
    const dialogs = createDialogManager();
    let closed!: Promise<boolean>;
    act(() => { closed = dialogs.previewHtml({ source: "<p>安全内容</p>" }); });

    expect(document.activeElement).toBe(document.querySelector(".html-preview-close"));
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));

    await expect(closed).resolves.toBe(true);
    expect(document.querySelector(".html-preview-dialog")).toBeNull();
    expect(document.activeElement).toBe(origin);
  });

  it("HTML 和 SVG 的右上角关闭按钮都能关闭预览并恢复焦点", async () => {
    const origin = document.getElementById("origin")!;
    origin.focus();
    const dialogs = createDialogManager();

    let htmlClosed!: Promise<boolean>;
    act(() => { htmlClosed = dialogs.previewHtml({ source: "<p>HTML 内容</p>", format: "html", title: "demo.html" }); });
    const htmlClose = document.querySelector<HTMLButtonElement>(".html-preview-close");
    expect(htmlClose).not.toBeNull();
    act(() => htmlClose!.click());
    await expect(htmlClosed).resolves.toBe(true);
    expect(document.querySelector(".html-preview-dialog")).toBeNull();
    expect(document.activeElement).toBe(origin);

    let svgClosed!: Promise<boolean>;
    act(() => { svgClosed = dialogs.previewHtml({ source: '<svg viewBox="0 0 10 10"><circle /></svg>', format: "svg", title: "chart.svg" }); });
    const svgClose = document.querySelector<HTMLButtonElement>(".html-preview-close");
    expect(svgClose).not.toBeNull();
    act(() => svgClose!.click());
    await expect(svgClosed).resolves.toBe(true);
    expect(document.querySelector(".html-preview-dialog")).toBeNull();
    expect(document.activeElement).toBe(origin);
  });

  it("SVG 使用同一无权限沙箱并应用受限画布布局", () => {
    const dialogs = createDialogManager();
    act(() => { dialogs.previewHtml({ source: '<svg viewBox="0 0 10 10"><script>alert(1)</script><circle cx="5" cy="5" r="4"/></svg>', format: "svg", title: "chart.svg" }); });

    const dialog = document.querySelector(".html-preview-dialog");
    const frame = dialog?.querySelector("iframe") as HTMLIFrameElement | null;
    expect(dialog?.textContent).toContain("SVG · 只读沙箱");
    expect(dialog?.textContent).toContain("chart.svg");
    expect(frame?.getAttribute("sandbox")).toBe("");
    expect(frame?.srcdoc).toContain("script-src 'none'");
    expect(frame?.srcdoc).toContain('class="svg-preview-root"');
    expect(frame?.srcdoc).toContain("<circle");
  });
});
