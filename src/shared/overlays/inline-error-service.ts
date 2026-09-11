export type FeedbackTone = "info" | "ok" | "danger";

export interface InlineErrorItem {
  id: number;
  message: string;
}

const listeners = new Set<() => void>();
let item: InlineErrorItem | null = null;
let sequence = 0;

function emit() {
  for (const listener of listeners) listener();
}

/**
 * 兼容原有 feedback 回调签名：普通状态与成功状态不再创建全局通知，
 * 只有错误会进入当前页面的内联错误行。
 */
export function reportInlineFeedback(
  message: unknown,
  { tone = "info" }: { tone?: FeedbackTone } = {}
) {
  // 成功或普通状态不显示，但它们代表上一项操作已推进，可清掉陈旧错误。
  if (tone !== "danger") {
    clearInlineError();
    return;
  }
  const normalizedMessage = String(message ?? "").trim();
  if (!normalizedMessage) return;
  if (item?.message === normalizedMessage) return;
  item = { id: ++sequence, message: normalizedMessage };
  emit();
}

export function clearInlineError() {
  if (!item) return;
  item = null;
  emit();
}

export const inlineErrorStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => item,
  getServerSnapshot: (): InlineErrorItem | null => null
};
