"use strict";

/**
 * 自研安全 Markdown 渲染。
 * 安全模型：先抽出围栏代码块（原文高亮），其余文本整体转义后再做结构化替换；
 * 链接协议白名单（http/https/mailto/#），图片来源白名单复用 normalize.isSafeImageSource。
 * 支持未闭合围栏代码块（流式渲染期间）。
 */

import { isSafeImageSource } from "../contracts/normalize.js";
import { icon } from "../resources/icons/index.js";

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isSafeLinkUrl(url) {
  const value = String(url || "").trim();
  if (!value || /[\s<>"']/i.test(value)) return false;
  if (value.startsWith("#")) return true;
  return /^(https?:\/\/|mailto:)/i.test(value);
}

// ---- 语法高亮（Primer 风格 token，颜色一律由 --syntax-* CSS 变量提供） ----

const KEYWORDS = new Set([
  // 通用
  "abstract", "as", "async", "await", "break", "case", "catch", "class", "const", "continue",
  "debugger", "def", "default", "delete", "do", "elif", "else", "enum", "except", "export",
  "extends", "false", "finally", "for", "from", "func", "function", "global", "if", "implements",
  "import", "in", "instanceof", "interface", "is", "lambda", "let", "match", "module", "new",
  "nil", "none", "not", "or", "and", "package", "pass", "print", "private", "protected", "public",
  "raise", "return", "self", "static", "struct", "super", "switch", "template", "this", "throw",
  "true", "try", "type", "typedef", "typeof", "undefined", "union", "use", "var", "void", "while",
  "with", "yield", "fn", "impl", "let", "mut", "pub", "where"
]);

const TOKEN_PATTERN = new RegExp([
  "(?<comment>/\\*[\\s\\S]*?(?:\\*/|$)|//[^\\n]*|#[^\\n]*|<!--[\\s\\S]*?(?:-->|$))",
  "(?<string>\"(?:\\\\.|[^\"\\\\\\n])*\"?|'(?:\\\\.|[^'\\\\\\n])*'?|`(?:\\\\.|[^`\\\\])*`?)",
  "(?<constant>\\b(?:0[xX][0-9a-fA-F]+|\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)\\b)",
  "(?<word>[A-Za-z_$][\\w$]*)"
].join("|"), "g");

export function highlightCode(code) {
  let result = "";
  let lastIndex = 0;
  TOKEN_PATTERN.lastIndex = 0;
  let match;
  while ((match = TOKEN_PATTERN.exec(code)) !== null) {
    if (match.index > lastIndex) {
      result += escapeHtml(code.slice(lastIndex, match.index));
    }
    const groups = match.groups || {};
    const text = match[0];
    if (groups.comment) {
      result += `<span class="tok-comment">${escapeHtml(text)}</span>`;
    } else if (groups.string) {
      const closed = (text.startsWith('"') && text.endsWith('"') && text.length > 1) ||
        (text.startsWith("'") && text.endsWith("'") && text.length > 1) ||
        (text.startsWith("`") && text.endsWith("`") && text.length > 1);
      result += `<span class="${closed ? "tok-string" : "tok-string"}">${escapeHtml(text)}</span>`;
    } else if (groups.constant) {
      result += `<span class="tok-constant">${escapeHtml(text)}</span>`;
    } else if (groups.word && KEYWORDS.has(text)) {
      result += `<span class="tok-keyword">${escapeHtml(text)}</span>`;
    } else if (groups.word && /^[A-Z][A-Za-z0-9_]*$/.test(text) && text.length > 1) {
      result += `<span class="tok-entity">${escapeHtml(text)}</span>`;
    } else {
      result += escapeHtml(text);
    }
    lastIndex = TOKEN_PATTERN.lastIndex;
  }
  if (lastIndex < code.length) {
    result += escapeHtml(code.slice(lastIndex));
  }
  return result;
}

// ---- 围栏代码块抽取（在转义前进行，保证高亮基于原文） ----

function extractFences(text) {
  const lines = text.split("\n");
  const fences = [];
  const output = [];
  let index = 0;
  let inFence = false;
  let fenceMark = "";
  let buffer = [];
  let lang = "";

  const flushFence = (closed) => {
    const code = buffer.join("\n");
    fences.push({ lang, code, closed });
    output.push(`\u0000CODE${fences.length - 1}\u0000`);
  };

  for (const line of lines) {
    const fenceMatch = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
    if (fenceMatch && !inFence) {
      inFence = true;
      fenceMark = fenceMatch[1][0].repeat(3);
      lang = fenceMatch[2].trim().split(/\s+/)[0] || "";
      buffer = [];
      continue;
    }
    if (inFence && fenceMatch && fenceMatch[1].startsWith(fenceMark[0])) {
      inFence = false;
      flushFence(true);
      continue;
    }
    if (inFence) {
      buffer.push(line);
      continue;
    }
    output.push(line);
  }
  if (inFence) flushFence(false);
  return { text: output.join("\n"), fences };
}

function renderCodeBlock(fence) {
  const langLabel = fence.lang ? escapeHtml(fence.lang) : "text";
  const previewKind = ["html", "htm"].includes(String(fence.lang || "").toLowerCase())
    ? "html"
    : String(fence.lang || "").toLowerCase() === "svg" ? "svg" : "";
  return [
    `<div class="code-block"${fence.closed ? "" : " data-streaming=\"true\""}>`,
    `<div class="code-head"><span class="code-lang">${langLabel}</span>`,
    `<span class="code-actions">`,
    fence.closed
      ? `<button type="button" class="code-action code-toggle" data-action="toggle-code" title="收起代码" aria-label="收起代码" aria-expanded="true">${icon("code", 15)}</button>`
      : "",
    previewKind && fence.closed
      ? `<button type="button" class="code-action code-run" data-action="run-preview" data-preview-kind="${previewKind}" title="运行${previewKind === "svg" ? " SVG" : " HTML"}" aria-label="运行${previewKind === "svg" ? " SVG" : " HTML"}">${icon("play", 15)}</button>`
      : "",
    `<button type="button" class="code-action code-copy" data-action="copy-code" data-copied="false" title="复制代码" aria-label="复制代码">${icon("copy", 15)}</button>`,
    `</span></div>`,
    `<pre class="code-source"><code>${highlightCode(fence.code)}</code></pre>`,
    `</div>`
  ].join("");
}

// ---- 行内格式（在已转义文本上处理） ----

function renderInline(text) {
  let out = text;

  // 行内代码优先（内部不再处理其它格式）
  const codeSpans = [];
  out = out.replace(/`([^`\n]+)`/g, (_all, code) => {
    codeSpans.push(`<code class="inline-code">${code}</code>`);
    return `\u0000SPAN${codeSpans.length - 1}\u0000`;
  });

  // 图片 ![alt](src)
  out = out.replace(/!\[([^\]\n]*)\]\(([^)\n]+)\)/g, (all, alt, src) => {
    if (!isSafeImageSource(src.replace(/&amp;/g, "&"))) return escapeHtml(alt) || all.replace(/!/g, "");
    return `<img class="md-image" src="${src}" alt="${alt}" loading="lazy" />`;
  });

  // 链接 [text](url)
  out = out.replace(/\[([^\]\n]+)\]\(([^)\n]+)\)/g, (all, label, url) => {
    const rawUrl = url.replace(/&amp;/g, "&");
    if (!isSafeLinkUrl(rawUrl)) return label;
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });

  // 粗体 / 斜体 / 删除线
  out = out.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  out = out.replace(/(^|[^_\w])_([^_\n]+)_/g, "$1<em>$2</em>");
  out = out.replace(/~~([^~\n]+)~~/g, "<del>$1</del>");

  out = out.replace(/\u0000SPAN(\d+)\u0000/g, (_all, idx) => codeSpans[Number(idx)] || "");
  return out;
}

// ---- 块级结构 ----

function renderBlocks(text, fences) {
  const lines = text.split("\n");
  const html = [];
  let i = 0;

  const isBlank = (line) => !line.trim();
  const isHeading = (line) => /^ {0,3}#{1,4} /.test(line);
  const isHr = (line) => /^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line);
  // 块解析发生在转义之后：`>` 已变成 `&gt;`
  const isQuote = (line) => /^ {0,3}(?:>|&gt;)/.test(line);
  const isListItem = (line) => /^ {0,3}(?:[-*+]\s(?:\[[ xX]\]\s)?|\d+[.)]\s)/.test(line);
  const isTableSep = (line) => /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(line) && /-/.test(line) && /\|/.test(line);
  const isTableRow = (line) => /\|/.test(line) && line.trim().length > 1;
  const isPlaceholder = (line) => /^\s*\u0000CODE\d+\u0000\s*$/.test(line);

  while (i < lines.length) {
    const line = lines[i];

    if (isPlaceholder(line)) {
      const idx = Number(line.match(/\u0000CODE(\d+)\u0000/)[1]);
      html.push(renderCodeBlock(fences[idx]));
      i += 1;
      continue;
    }
    // 行内混排的占位符（如列表内）保持原样交给段落/列表处理
    if (line.includes("\u0000CODE")) {
      html.push(renderInline(line).replace(/\u0000CODE(\d+)\u0000/g, (_all, idx) => renderCodeBlock(fences[Number(idx)])));
      i += 1;
      continue;
    }

    if (isBlank(line)) {
      i += 1;
      continue;
    }

    if (isHr(line)) {
      html.push("<hr />");
      i += 1;
      continue;
    }

    if (isHeading(line)) {
      const match = line.match(/^ {0,3}(#{1,4})\s+(.*)$/);
      const level = match[1].length;
      html.push(`<h${level}>${renderInline(match[2].trim())}</h${level}>`);
      i += 1;
      continue;
    }

    if (isQuote(line)) {
      const quoted = [];
      while (i < lines.length && isQuote(lines[i])) {
        quoted.push(lines[i].replace(/^ {0,3}(?:>|&gt;)\s?/, ""));
        i += 1;
      }
      html.push(`<blockquote>${renderBlocks(quoted.join("\n"), fences)}</blockquote>`);
      continue;
    }

    // 表格：当前行是表格行且下一行是分隔行（在段落消费之前判断）
    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const headerCells = splitTableRow(line);
      const rows = [];
      let j = i + 2;
      while (j < lines.length && isTableRow(lines[j]) && !isTableSep(lines[j])) {
        rows.push(splitTableRow(lines[j]));
        j += 1;
      }
      const thead = `<thead><tr>${headerCells.map((cell) => `<th>${renderInline(cell.trim())}</th>`).join("")}</tr></thead>`;
      const tbody = rows.length
        ? `<tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell.trim())}</td>`).join("")}</tr>`).join("")}</tbody>`
        : "";
      html.push(`<table>${thead}${tbody}</table>`);
      i = j;
      continue;
    }

    if (isListItem(line)) {
      const items = [];
      let ordered = /^\s*\d+[.)]\s/.test(line);
      while (i < lines.length && !isBlank(lines[i])) {
        const itemLine = lines[i];
        if (!isListItem(itemLine)) break;
        if (/^\s*\d+[.)]\s/.test(itemLine)) ordered = ordered || true;
        const taskMatch = itemLine.match(/^ {0,3}[-*+]\s\[( |x|X)\]\s(.*)$/);
        if (taskMatch) {
          items.push({ type: "task", checked: taskMatch[1].toLowerCase() === "x", text: itemLine });
        } else {
          items.push({ type: ordered && !/^ {0,3}[-*+]\s/.test(itemLine) ? "ordered" : "bullet", text: itemLine });
        }
        i += 1;
      }
      if (items.length && items[0].type === "task") {
        html.push(`<ul>${items.map((item) => {
          const taskMatch = item.text.match(/^ {0,3}[-*+]\s\[( |x|X)\]\s(.*)$/);
          const checked = taskMatch[1].toLowerCase() === "x";
          return `<li class="task-item"><span class="task-row"><span class="task-box" data-checked="${checked}"></span><span class="task-text" data-checked="${checked}">${renderInline(taskMatch[2].trim())}</span></span></li>`;
        }).join("")}</ul>`);
      } else if (ordered) {
        html.push(`<ol>${items.map((item) => `<li>${renderInline(item.text.replace(/^ {0,3}(?:[-*+]|\d+[.)])\s/, "").trim())}</li>`).join("")}</ol>`);
      } else {
        html.push(`<ul>${items.map((item) => `<li>${renderInline(item.text.replace(/^ {0,3}[-*+]\s/, "").trim())}</li>`).join("")}</ul>`);
      }
      continue;
    }

    // 段落：连续非特殊行
    const paragraph = [];
    while (
      i < lines.length && !isBlank(lines[i]) && !isHeading(lines[i]) && !isHr(lines[i]) &&
      !isQuote(lines[i]) && !isListItem(lines[i]) && !isPlaceholder(lines[i])
    ) {
      paragraph.push(lines[i]);
      i += 1;
    }
    if (paragraph.length) {
      html.push(`<p>${renderInline(paragraph.join("\n")).replace(/\n/g, "<br />")}</p>`);
    } else {
      i += 1;
    }
  }

  return html.join("");
}

function splitTableRow(line) {
  let value = line.trim();
  if (value.startsWith("|")) value = value.slice(1);
  if (value.endsWith("|")) value = value.slice(0, -1);
  return value.split("|").map((cell) => cell.trim());
}

export function renderMarkdown(text) {
  const input = String(text ?? "");
  if (!input.trim()) return "";
  const { text: stripped, fences } = extractFences(input);
  const escaped = escapeHtml(stripped);
  return renderBlocks(escaped, fences);
}
