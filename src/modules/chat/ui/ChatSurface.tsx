import { Surface, Button, TextField, TextArea } from "../../../shared/ui/primitives";
import { memo } from "react";
import { TEXT_FILE_EXTENSIONS } from "../../../contracts/constants.js";
import { icon } from "../../../resources/icons/index.js";
import { MessageList } from "./MessageList";
import { ExtensionSlot } from "../../../shared/state/contributions";
import { InlineErrorLine } from "../../../shared/overlays/InlineErrorLine";
import type { ExternalStore } from "../../../shared/state/react";

const trusted = (value: string) => ({ __html: value });

/**
 * Chat 的稳定 DOM 骨架由 React 创建；高频消息和输入状态通过细粒度订阅/运行时
 * 适配层更新这些既有节点，不因 App Shell 重渲染而重建 textarea 或消息滚动容器。
 */
export const ChatSurface = memo(function ChatSurface({ store, active = true }: { store: ExternalStore & { state: any }; active?: boolean }) {
  const accept = `.${TEXT_FILE_EXTENSIONS.join(",.")},.png,.jpg,.jpeg,.webp,.gif,image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.gz,.tar`;
  return <>
    <div className="message-scroll" id="messageScroll">
      <div className="message-list" id="messageList"><MessageList store={store} /></div>
    </div>
    <div className="composer-zone">
      <div className="composer-inner">
        <InlineErrorLine className="composer-inline-error" active={active} />
        <Button
          type="button"
          className="new-replies-btn"
          id="newRepliesBtn"
          hidden
          dangerouslySetInnerHTML={trusted(`${icon("chevronDown", 14)} 有新回复`)}
        />
        <ExtensionSlot name="composer.before" store={store} />
        <Surface className="composer-paper" id="composerPaper">
          <div className="composer-chips" id="composerChips" hidden />
          <div className="composer-input-shell">
            <TextArea id="composerInput" className="composer-input" rows={1} placeholder="输入消息，或输入 / 使用指令" disabled />
          </div>
          <div className="composer-controls">
            <Button type="button" className="composer-attach-btn" id="attachBtn" title="添加附件" aria-label="添加附件" dangerouslySetInnerHTML={trusted(icon("plus", 20))} />
            <div className="runtime-cluster" id="runtimeCluster">
              <Button
                type="button"
                className="runtime-summary-btn"
                id="runtimeBtn"
                aria-haspopup="dialog"
                aria-expanded="false"
                title="模型与思考强度"
              >
                <span className="runtime-model" id="modelValue">未选择</span>
                <span className="runtime-effort" id="effortValue">中等</span>
                <span className="runtime-chevron" aria-hidden="true" dangerouslySetInnerHTML={trusted(icon("chevronDown", 13))} />
              </Button>
              <Button
                type="button"
                className="context-ring-btn"
                id="usageBtn"
                aria-describedby="contextTooltip"
                aria-label="压缩上下文"
              >
                <svg viewBox="0 0 40 40" aria-hidden="true">
                  <circle className="context-ring-track" cx="20" cy="20" r="16" />
                  <circle
                    className="context-ring-value"
                    cx="20"
                    cy="20"
                    r="16"
                    pathLength={100}
                    strokeDasharray="100"
                    strokeDashoffset="100"
                    data-usage-ring
                  />
                </svg>
              </Button>
              <span className="composer-send"><Button type="button" className="send-btn" id="sendBtn" title="发送" aria-label="发送" dangerouslySetInnerHTML={trusted(icon("send", 17))} /></span>
            </div>
          </div>
        </Surface>
        <div className="composer-hint">Enter 发送 · Shift + Enter 换行 · / 指令</div>
      </div>
    </div>
    <TextField type="file" id="attachmentInput" multiple hidden accept={accept} />
  </>;
});
