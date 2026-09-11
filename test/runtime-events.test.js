"use strict";

import { describe, expect, it } from "vitest";
import { normalizeToolEvents } from "../src/modules/chat/services/runtime-events.js";
import { renderAssistantFlowHtml, renderToolActivitiesHtml } from "../src/modules/chat/services/message-rendering.js";

describe("runtime event timeline", () => {
  it("按 callId 合并生命周期并保留首次出现顺序", () => {
    const normalized = normalizeToolEvents([
      { type: "tool_use", callId: "call-a", name: "lookup", source: "tool", status: "requested", input: { city: "杭州" }, contentOffset: 12 },
      { type: "tool_use", callId: "call-b", name: "search", source: "tool", status: "requested", input: { query: "天气" } },
      { type: "tool_result", callId: "call-a", name: "lookup", source: "tool", status: "succeeded", output: "26°C", durationMs: 120, contentOffset: 80 }
    ]);

    expect(normalized.parts).toHaveLength(2);
    expect(normalized.parts.map((part) => part.callId)).toEqual(["call-a", "call-b"]);
    expect(normalized.parts[0]).toMatchObject({ type: "tool_result", status: "succeeded", output: "26°C", durationMs: 120, contentOffset: 12 });
    expect(normalized.parts[0].input).toContain("杭州");
    expect(normalized.parts[1]).toMatchObject({ type: "tool_call", status: "requested" });
  });

  it("结果事件补齐文本和媒体，Skill 作为独立轻量条目保留", () => {
    const normalized = normalizeToolEvents([
      { type: "skill_applied", skillId: "skill-review", name: "代码审查", source: "skill" },
      { type: "tool_use", callId: "call-image", name: "render", source: "sandbox", status: "requested" },
      {
        type: "tool_result",
        callId: "call-image",
        name: "render",
        source: "sandbox",
        status: "succeeded",
        content: [
          { type: "json", data: { ok: true } },
          { type: "image", data: "aGVsbG8=", mime_type: "image/png", alt: "预览" }
        ]
      }
    ]);

    expect(normalized.parts).toHaveLength(2);
    expect(normalized.parts[0]).toMatchObject({ type: "skill_applied", status: "applied" });
    expect(normalized.parts[1].content[0].text).toContain('"ok": true');
    expect(normalized.images).toHaveLength(1);
  });

  it("轻量时间线默认收起结果并保留可折叠参数", () => {
    const { parts } = normalizeToolEvents([
      { type: "tool_result", callId: "call-1", name: "lookup", source: "tool", status: "succeeded", input: { q: "test" }, output: "done" }
    ]);
    const html = renderToolActivitiesHtml(parts);

    expect(html).toContain('aria-label="工具运行记录"');
    expect(html).toContain("tool-activity is-success");
    expect(html).toContain('<details class="tool-result tool-activity is-success" data-call-id="call-1">');
    expect(html).not.toContain('data-call-id="call-1" open');
    expect(html).toContain("调用了 Tool");
    expect(html).toContain("查看调用参数");
    expect(html).toContain("done");
  });

  it("代码解释器文件继承首次调用锚点并获得稳定产物 ID", () => {
    const source = "data:text/html;base64,PGgxPk9LPC9oMT4=";
    const normalized = normalizeToolEvents([
      { type: "tool_use", callId: "call-code", name: "clawbox_code_interpreter", source: "sandbox", status: "requested", contentOffset: 9 },
      { type: "tool_result", callId: "call-code", name: "clawbox_code_interpreter", source: "sandbox", status: "succeeded", contentOffset: 99, content: [{ type: "file", name: "demo.html", mimeType: "text/html", source, size: 11 }] }
    ]);

    expect(normalized.files).toEqual([expect.objectContaining({
      name: "demo.html",
      mimeType: "text/html",
      source,
      contentOffset: 9,
      callId: "call-code",
      artifactId: "call-code:0"
    })]);
  });

  it("按正文锚点交错渲染工具，并为后续流式正文保留尾段", () => {
    const intro = "我先读取项目状态。\n\n";
    const middle = "状态已确认，接着检查类型。\n\n";
    const ending = "检查完成。";
    const content = `${intro}${middle}${ending}`;
    const parts = [
      { type: "tool_result", callId: "call-status", name: "git_status", source: "tool", status: "succeeded", output: "clean", contentOffset: intro.length },
      { type: "tool_result", callId: "call-types", name: "typecheck", source: "tool", status: "succeeded", output: "passed", contentOffset: intro.length + middle.length }
    ];
    const html = renderAssistantFlowHtml(content, parts);

    expect(html.indexOf("我先读取项目状态")).toBeLessThan(html.indexOf("git_status"));
    expect(html.indexOf("git_status")).toBeLessThan(html.indexOf("状态已确认"));
    expect(html.indexOf("状态已确认")).toBeLessThan(html.indexOf("typecheck"));
    expect(html.indexOf("typecheck")).toBeLessThan(html.indexOf("检查完成"));
    expect(html).toContain(`data-content-start="${intro.length + middle.length}"`);
  });

  it("把可预览产物和工具一起放进正文锚点，而不是消息末尾", () => {
    const intro = "先创建页面。\n\n";
    const html = renderAssistantFlowHtml(`${intro}页面已创建。`, [{
      type: "tool_result", callId: "call-code", name: "code", status: "succeeded", contentOffset: intro.length
    }], [{
      name: "demo.html", mimeType: "text/html", source: "data:text/html;base64,PGgxPk9LPC9oMT4=", size: 11,
      contentOffset: intro.length, artifactId: "call-code:0"
    }], "message-1");

    expect(html.indexOf("先创建页面")).toBeLessThan(html.indexOf("demo.html"));
    expect(html.indexOf("demo.html")).toBeLessThan(html.indexOf("页面已创建"));
    expect(html).toContain('data-action="artifact-code"');
    expect(html).toContain('data-action="artifact-run"');
    expect(html).toContain('data-action="artifact-copy"');
    expect(html).toContain('data-preview-kind="html"');
  });

  it("远程 HTML 产物只允许下载，不由预览器二次联网读取", () => {
    const html = renderAssistantFlowHtml("完成", [], [{
      name: "remote.html", mimeType: "text/html", source: "https://example.com/remote.html", size: 12,
      contentOffset: 0, artifactId: "remote:0"
    }], "message-remote");
    expect(html).toContain("remote.html");
    expect(html).toContain("file-download");
    expect(html).not.toContain('data-action="artifact-run"');
    expect(html).not.toContain('data-action="artifact-code"');
    expect(html).not.toContain('data-action="artifact-copy"');
  });
});
