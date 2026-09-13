/** Conservative, deterministic estimate shared by settings previews and send preflight. */
export function estimateContextTokens(value) {
  if (value == null) return 0;
  if (typeof value === "string") return Math.ceil(value.length / 2);
  if (Array.isArray(value)) return value.reduce((sum, entry) => sum + estimateContextTokens(entry), 0);
  if (typeof value !== "object") return 1;
  let tokens = 4;
  for (const [key, entry] of Object.entries(value)) {
    if (["source", "data", "url", "image_url"].includes(key)) {
      if (value.type === "image" || value.type === "image_url" || value.type === "input_image") tokens += 4096;
      else if (value.type === "file") tokens += Math.max(4096, Math.ceil((Number(value.size) || String(entry).length * 0.75) / 2));
      continue;
    }
    tokens += estimateContextTokens(entry);
  }
  return tokens;
}
export function resolveInputBudget(model, config) {
  const available = Math.floor(model.contextWindow * 0.95) - model.maxTokens;
  if (available < 1) throw new Error("模型最大输出额度与安全余量已占满上下文窗口，请调整模型额度。");
  return available;
}
/**
 * Compress completed history without a fixed turn-count reserve.
 * A pending reply keeps its entire user/tool turn outside the summary.
 */
export function compressionPrefix(messages, pending = false) {
  const visible = messages.filter((m) => !m.noticeKind);
  const last = visible.at(-1);
  if (!pending && last?.role === "assistant" && !last.tool_calls?.length) return visible;
  let boundary = visible.length - 1;
  while (boundary >= 0 && visible[boundary].role !== "user") boundary--;
  return boundary > 0 ? visible.slice(0, boundary) : [];
}

/** The trigger is inclusive and only a successful response can initiate it. */
export function shouldCompressResponse(response, used, budget, threshold) {
  return response.completed === true && !response.stopped && !response.error && used >= budget * threshold / 100;
}
