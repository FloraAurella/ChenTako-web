import { memo, useLayoutEffect, useRef } from "react";
import { renderEmptyStageHtml, renderMessageHtmlCached } from "../services/message-rendering.js";
import { resolveEffectiveModelConfig } from "../../connections/public/domain_models.js";
import { getActivePath, getUserVariants } from "../domain/tree.js";
import { useStoreValue, type ExternalStore } from "../../../shared/state/react";

interface MessageListProps { store: ExternalStore & { state: any } }

function instantBranchIds() {
  if (typeof document === "undefined") return new Set<string>();
  const list = document.getElementById("messageList");
  let ids: string[] = [];
  try {
    ids = JSON.parse(list?.dataset.instantBranchIds || "[]");
  } catch {
    ids = [];
  }
  return new Set(ids);
}

export function MessageList({ store }: MessageListProps) {
  const app = useStoreValue<any>(store, "app");
  const composer = useStoreValue<any>(store, "composer");
  const conversationId = String(app.activeConversationId || "");
  const conversation = useStoreValue<any>(store, `conversation:${conversationId}`);
  const stream = useStoreValue<any>(store, `stream:${conversationId}`);
  const activeStreams = useStoreValue<Set<string>>(store, "stream-list");
  const compression = useStoreValue<Set<string>>(store, "compression");
  if (!conversation) return null;
  const provider = store.state.providers.find((entry: any) => entry.id === conversation.providerId);
  const providerName = provider?.displayName || conversation.providerSnapshot?.displayName || "未命名供应商";
  const streamExpectsImage = provider ? resolveEffectiveModelConfig(provider, conversation.model).imageOutput === true : false;
  const visibleMessages = getActivePath(conversation);
  if (!visibleMessages.length) return <MessageHtml html={renderEmptyStageHtml(provider && provider.enabled !== false && provider.models.includes(conversation.model) ? providerName : "", app.backend?.status || store.state.backend.status)} />;
  const activeMessageId = stream?.messageId || "";
  const streamActive = Boolean(activeMessageId || activeStreams.has(conversationId));
  const editingMessageId = composer.editingMessage?.conversationId === conversationId
    ? composer.editingMessage.messageId
    : "";
  const instantBranches = instantBranchIds();
  return <>{visibleMessages.map((message: any, index: number) => {
    if (message.outputSurface === 'workspace') return null;
    const variants = message.role === "user" ? getUserVariants(conversation, message.id, visibleMessages) : null;
    return <MessageEntry
    key={`${conversationId}:${message.id}`}
    store={store}
    conversationId={conversationId}
    messageId={message.id}
    index={index}
    conversation={conversation}
    providerName={providerName}
    streamActive={streamActive}
    streamMessageId={activeMessageId}
    streamExpectsImage={streamExpectsImage}
    compressing={compression.has(conversationId)}
    pathLength={visibleMessages.length}
    branch={variants && variants.total > 1 && variants.activeIndex >= 0 ? {
      current: variants.activeIndex + 1,
      total: variants.total,
      hasPrevious: variants.activeIndex > 0,
      hasNext: variants.activeIndex < variants.total - 1
    } : null}
    suppressEntryAnimation={instantBranches.has(message.id)}
    editingMessageId={editingMessageId}
  />;
  })}</>;
}

type MessageEntryProps = {
  store: ExternalStore;
  conversationId: string;
  messageId: string;
  index: number;
  pathLength: number;
  suppressEntryAnimation: boolean;
  conversation: any;
  providerName: string;
  streamActive: boolean;
  streamMessageId: string;
  streamExpectsImage: boolean;
  compressing: boolean;
  branch: { current: number; total: number; hasPrevious: boolean; hasNext: boolean } | null;
  editingMessageId: string;
};

const MessageEntry = memo(function MessageEntry({ store, conversationId, messageId, index, pathLength, suppressEntryAnimation, conversation, providerName, streamActive, streamMessageId, streamExpectsImage, compressing, branch, editingMessageId }: MessageEntryProps) {
  const message = useStoreValue<any>(store, `message:${conversationId}:${messageId}`);
  // Keep the mount-time suppression stable for this node's lifetime. If it
  // were removed after the switch, the default message-in animation would
  // become active and make unchanged branch content flash later.
  const suppressMountAnimation = useRef(suppressEntryAnimation).current;
  useLayoutEffect(() => {
    const metrics = (window as any).__AI_CHATBOX_STREAM_METRICS__;
    if (metrics) metrics.reactCommits = Number(metrics.reactCommits || 0) + 1;
  });
  if (!message) return null;
  return <MessageHtml html={renderMessageHtmlCached(message, {
    index,
    pathLength,
    branch,
    suppressEntryAnimation: suppressMountAnimation,
    conversation,
    providerName,
    streamActive,
    streamMessageId,
    streamExpectsImage,
    editingMessageId,
    compressing
  })} />;
}, areMessageEntryPropsEqual);

function sameBranch(a: MessageEntryProps["branch"], b: MessageEntryProps["branch"]) {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.current === b.current && a.total === b.total &&
    a.hasPrevious === b.hasPrevious && a.hasNext === b.hasNext;
}

function areMessageEntryPropsEqual(previous: MessageEntryProps, next: MessageEntryProps) {
  const previousIsLast = previous.index === previous.pathLength - 1;
  const nextIsLast = next.index === next.pathLength - 1;
  return previous.store === next.store &&
    previous.conversationId === next.conversationId &&
    previous.messageId === next.messageId &&
    previous.index === next.index &&
    previousIsLast === nextIsLast &&
    previous.conversation?.model === next.conversation?.model &&
    previous.providerName === next.providerName &&
    previous.streamActive === next.streamActive &&
    previous.streamMessageId === next.streamMessageId &&
    previous.streamExpectsImage === next.streamExpectsImage &&
    previous.compressing === next.compressing &&
    previous.editingMessageId === next.editingMessageId &&
    sameBranch(previous.branch, next.branch);
}

function MessageHtml({ html }: { html: string }) {
  const parsed = parseRoot(html);
  if (!parsed) return null;
  return <div className={parsed.className} data-message-id={parsed.messageId || undefined} role={parsed.role || undefined} tabIndex={parsed.tabIndex} dangerouslySetInnerHTML={{ __html: parsed.innerHtml }} />;
}

function parseRoot(html: string) {
  if (!html) return null;
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  const root = template.content.firstElementChild as HTMLElement | null;
  if (!root) return null;
  return { className: root.className, messageId: root.dataset.messageId || "", role: root.getAttribute("role") || "", tabIndex: root.hasAttribute("tabindex") ? Number(root.getAttribute("tabindex")) : undefined, innerHtml: root.innerHTML };
}
