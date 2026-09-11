import { estimateContextTokens, resolveInputBudget } from "../domain/budget.js";
"use strict";

/**
 * 上下文用量的唯一估算入口。
 *
 * 圆环、hover tooltip 和展开面板共用同一份结果；消息范围与真正的
 * requestMessages 保持一致：压缩生效后只统计「压缩摘要 + 压缩点之后的
 * 实际消息」，已被摘要替代的历史不再与摘要重复计入。
 *
 * 供应商返回的最新一轮真实 totalTokens 是最可靠的上下文快照：它已经包含
 * 该次请求的输入（系统提示、摘要、附件和历史）与输出。只有这个快照之后
 * 新增的消息，或尚未取得真实 usage 的会话，才按字符数估算。
 */

import { LIMITS } from "../../../contracts/constants.js";
import { getMessagesAfterCompression, getValidContextCompression } from "../../chat/public/domain_queries.js";

function estimateMessageTokens(message) {
  if (message.role === "user") {
    const chars = (message.content || "").length +
      (message.files || []).reduce((sum, file) => sum + (file.text || "").length, 0);
    return chars / LIMITS.estimateCharsPerToken;
  }
  return (message.content || "").length / LIMITS.estimateCharsPerToken;
}

function measuredUsage(message) {
  const usage = message?.role === "assistant" ? message.usage : null;
  const totalTokens = Math.max(0, Number(usage?.totalTokens) || 0);
  if (!usage || usage.estimated === true || !totalTokens) return null;
  const inputTokens = Math.max(0, Number(usage.inputTokens) || 0);
  const outputTokens = Math.max(0, Number(usage.outputTokens) || 0);
  return {
    inputTokens,
    outputTokens,
    totalTokens: Math.max(totalTokens, inputTokens + outputTokens)
  };
}

/**
 * @param {object} conversation 当前会话
 * @param {number} contextWindow 已解析的模型上下文窗口（token）
 */
export function computeContextUsage(conversation, contextWindow, options = null) {
  if (options) {
    const compression = getValidContextCompression(conversation);
    const messages = getMessagesAfterCompression(conversation).filter((m) => !m.noticeKind);
    const summaryTokens = estimateContextTokens(compression?.compression.summary || "");
    const fixedContext = options.fixedContext || '';
    const systemPrompt = options.config.systemPrompt || '';
    const draft = options.draft || null;
    const inputTokens = estimateContextTokens({ systemPrompt: systemPrompt + fixedContext, messages: [...messages, ...(draft ? [draft] : [])], extensions: options.extensions });
    const breakdown = {
      system: estimateContextTokens(systemPrompt),
      fixed: estimateContextTokens(fixedContext),
      history: estimateContextTokens(messages) + summaryTokens,
      draft: estimateContextTokens(draft),
      extensions: estimateContextTokens(options.extensions),
      reserved: options.maxTokens || 0
    };
    let window = contextWindow;
    try { window = resolveInputBudget({ contextWindow, maxTokens: options.maxTokens }, options.config); } catch { /* Show exhausted budget; preflight supplies the actionable error. */ }
    const used = inputTokens + summaryTokens;
    return { breakdown, contextErrors: options.contextErrors || [], window, used, remaining: Math.max(0, window - used), percent: Math.min(1, used / window), inputTokens, outputTokens: 0, summaryTokens,
      approximate: true, approximateInput: true, approximateSummary: true, approximateOutput: true,
      compressed: Boolean(compression), compressedCount: compression?.compression.sourceMessageCount || 0 };
  }
  const window = contextWindow || LIMITS.defaultContextWindow;
  const messages = getMessagesAfterCompression(conversation).filter((message) => !message.noticeKind);
  let measuredIndex = -1;
  let measured = null;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    measured = measuredUsage(messages[index]);
    if (measured) {
      measuredIndex = index;
      break;
    }
  }

  // 最新真实 usage 是截至该助手回复的完整上下文快照。不要再次累加快照前的
  // 用户输入、助手输出或压缩摘要，否则既会偏离消息脚注，也会重复计数。
  if (measured) {
    let suffixInputTokens = 0;
    let suffixOutputTokens = 0;
    let approximateInput = false;
    let approximateOutput = false;
    for (const message of messages.slice(measuredIndex + 1)) {
      if (message.role === "user") {
        suffixInputTokens += estimateMessageTokens(message);
        approximateInput = true;
      } else {
        suffixOutputTokens += estimateMessageTokens(message);
        approximateOutput = true;
      }
    }
    const used = measured.totalTokens + suffixInputTokens + suffixOutputTokens;
    const compression = getValidContextCompression(conversation);
    return {
      window,
      used: Math.round(used),
      remaining: Math.max(0, Math.round(window - used)),
      percent: Math.min(1, Math.max(0, used / window)),
      inputTokens: Math.round(measured.inputTokens + suffixInputTokens),
      outputTokens: Math.round(measured.outputTokens + suffixOutputTokens),
      // 摘要已经包含在供应商实测的 inputTokens/totalTokens 中，不再单列相加。
      summaryTokens: 0,
      approximateInput,
      approximateSummary: false,
      approximateOutput,
      approximate: approximateInput || approximateOutput,
      compressed: Boolean(compression),
      compressedCount: compression ? compression.compression.sourceMessageCount : 0
    };
  }

  let inputTokens = 0;
  let outputTokens = 0;
  let outputFromProvider = true;

  // 与 requestMessages 同源：压缩点之后的消息，跳过系统提示（如压缩进度）。
  for (const message of messages) {
    if (message.role === "user") {
      inputTokens += estimateMessageTokens(message);
    } else if (message.usage && message.usage.outputTokens && !message.usage.estimated) {
      outputTokens += message.usage.outputTokens;
    } else {
      outputTokens += estimateMessageTokens(message);
      outputFromProvider = false;
    }
  }

  const compression = getValidContextCompression(conversation);
  const summaryTokens = compression
    ? compression.compression.summary.length / LIMITS.estimateCharsPerToken
    : 0;
  const used = inputTokens + outputTokens + summaryTokens;
  return {
    window,
    used: Math.round(used),
    remaining: Math.max(0, Math.round(window - used)),
    // 占用比例夹在 0–100%，窗口异常小或超长回复都不会让圆环溢出
    percent: Math.min(1, Math.max(0, used / window)),
    inputTokens: Math.round(inputTokens),
    outputTokens: Math.round(outputTokens),
    summaryTokens: Math.round(summaryTokens),
    // 输入与摘要始终按字符估算；输出仅在每条助手消息都带真实 usage 时才视为实测
    approximateInput: true,
    approximateSummary: summaryTokens > 0,
    approximateOutput: !outputFromProvider,
    approximate: true,
    compressed: Boolean(compression),
    compressedCount: compression ? compression.compression.sourceMessageCount : 0
  };
}
