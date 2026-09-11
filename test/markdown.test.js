"use strict";

import { describe, it, expect } from "vitest";
import { renderMarkdown, escapeHtml } from "../src/shared/markdown.js";

describe("escapeHtml", () => {
  it("转义五个危险字符", () => {
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;"
    );
  });
});

describe("renderMarkdown 基础结构", () => {
  it("段落与行内格式", () => {
    const html = renderMarkdown("你好 **加粗** *斜体* ~~删除~~ `code`");
    expect(html).toContain("<p>");
    expect(html).toContain("<strong>加粗</strong>");
    expect(html).toContain("<em>斜体</em>");
    expect(html).toContain("<del>删除</del>");
    expect(html).toContain('<code class="inline-code">code</code>');
  });

  it("标题 h1-h4 使用衬线结构", () => {
    const html = renderMarkdown("## 标题二\n\n### 标题三");
    expect(html).toContain("<h2>标题二</h2>");
    expect(html).toContain("<h3>标题三</h3>");
  });

  it("无序列表与有序列表", () => {
    const html = renderMarkdown("- 甲\n- 乙\n\n1. 一\n2. 二");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>甲</li>");
    expect(html).toContain("<ol>");
    expect(html).toContain("<li>一</li>");
  });

  it("任务列表三态", () => {
    const html = renderMarkdown("- [x] 完成\n- [ ] 待办");
    expect(html).toContain('data-checked="true"');
    expect(html).toContain('data-checked="false"');
    expect(html).toContain("task-item");
  });

  it("表格", () => {
    const html = renderMarkdown("| A | B |\n| --- | --- |\n| 1 | 2 |");
    expect(html).toContain("<table>");
    expect(html).toContain("<th>A</th>");
    expect(html).toContain("<td>2</td>");
  });

  it("引用与分隔线", () => {
    const html = renderMarkdown("> 引文一句\n\n---");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("<hr />");
  });

  it("空输入返回空字符串", () => {
    expect(renderMarkdown("")).toBe("");
    expect(renderMarkdown("   ")).toBe("");
  });
});

describe("renderMarkdown 安全", () => {
  it("转义原始 HTML，不执行模型输出的标签", () => {
    const html = renderMarkdown("<script>alert(1)</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("链接协议白名单：javascript 被拒绝", () => {
    const html = renderMarkdown("[点我](javascript:alert(1))");
    expect(html).not.toContain('href="javascript');
  });

  it("链接协议白名单：https 与 mailto 放行", () => {
    const html = renderMarkdown("[官网](https://example.com) [邮件](mailto:a@b.c)");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('href="mailto:a@b.c"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("图片源白名单：data:image png 放行，http 公网拒绝", () => {
    const ok = renderMarkdown("![好图](data:image/png;base64,aGVsbG8=)");
    expect(ok).toContain('src="data:image/png;base64,aGVsbG8="');
    const bad = renderMarkdown("![坏图](http://evil.example.com/x.png)");
    expect(bad).not.toContain("evil.example.com");
  });
});

describe("renderMarkdown 代码块", () => {
  it("完整代码块：语言标签 + SVG 复制按钮 + 高亮 token", () => {
    const html = renderMarkdown("```js\nconst x = \"hi\"; // 注释\n```");
    expect(html).toContain("code-block");
    expect(html).toContain('<span class="code-lang">js</span>');
    expect(html).toContain('data-action="copy-code"');
    expect(html).toContain('data-action="toggle-code"');
    expect(html).toContain('aria-label="复制代码"');
    expect(html).toContain("<svg");
    expect(html).not.toContain('data-action="run-preview"');
    expect(html).toContain("tok-keyword");
    expect(html).toContain("tok-string");
    expect(html).toContain("tok-comment");
  });

  it("未闭合代码块也能渲染（流式期间）", () => {
    const html = renderMarkdown("前文\n\n```python\ndef f():\n  return 1");
    expect(html).toContain("code-block");
    expect(html).toContain('data-streaming="true"');
    expect(html).toContain('<span class="tok-keyword">def</span>');
    expect(html).toContain("f():");
    expect(html).toContain("return");
  });

  it("代码块中的 HTML 被转义", () => {
    const html = renderMarkdown("```html\n<div>&</div>\n```");
    expect(html).toContain("&lt;div&gt;&amp;&lt;/div&gt;");
    expect(html).toContain('data-action="toggle-code"');
    expect(html).toContain('data-action="run-preview"');
    expect(html).toContain('data-preview-kind="html"');
    expect(html).toContain('aria-label="运行 HTML"');
    expect((html.match(/<button/g) || [])).toHaveLength(3);
    expect((html.match(/<svg/g) || [])).toHaveLength(3);
  });

  it("HTM / SVG 同样可运行，未闭合围栏不提供运行与折叠", () => {
    expect(renderMarkdown("```htm\n<main>ok</main>\n```")).toContain('data-preview-kind="html"');
    expect(renderMarkdown("```svg\n<svg viewBox=\"0 0 10 10\"></svg>\n```")).toContain('data-preview-kind="svg"');
    const streaming = renderMarkdown("```html\n<main>streaming");
    expect(streaming).not.toContain('data-action="run-preview"');
    expect(streaming).not.toContain('data-action="toggle-code"');
  });
});
