import { ProjectSettingsButton } from "../../projects/public/settings";
import { Button, Surface } from "../../../shared/ui/primitives";
import { useEffect, useRef, useState } from "react";
import { icon } from "../../../resources/icons/index.js";
import { isTemporaryConversation } from "../domain/queries.js";
import { formatRelativeDays } from "../../../shared/utils.js";
import { preloadConversationMessageHtml } from "../services/message-rendering.js";
import { useStoreValue, type ExternalStore } from "../../../shared/state/react";

interface ConversationListProps { store: ExternalStore & { state: any } }
const scheduledPreloads = new Set<string>();

export function ConversationList({ store }: ConversationListProps) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, []);
  const conversations = useStoreValue<any[]>(store, "conversation-list");
  const projects = useStoreValue<any[]>(store, "projects");
  const [showAll, setShowAll] = useState<Set<string>>(() => new Set());
  const providers = useStoreValue<any[]>(store, "providers");
  const sidebar = useStoreValue<any>(store, "sidebar");
  const activeStreams = useStoreValue<Set<string>>(store, "stream-list");
  const activeId = store.state.activeConversationId;
  const activeProjectId = conversations.find((item) => item.id === activeId)?.projectId;
  const query = String(sidebar.query || "").trim().toLowerCase();
  const lastSelection = useRef("");
  const pendingReveal = useRef(false);
  const searching = Boolean(query);
  useEffect(() => {
    const selection = `${activeId}:${activeProjectId ?? ""}`;
    if (lastSelection.current !== selection) {
      lastSelection.current = selection;
      pendingReveal.current = true;
    }
    if (searching || !pendingReveal.current) return;
    pendingReveal.current = false;
    (store as any).revealConversation(activeId);
    if (activeProjectId) {
      const siblings = conversations.filter((item) => !isTemporaryConversation(item) && item.projectId === activeProjectId);
      if (siblings.findIndex((item) => item.id === activeId) >= 5) {
        setShowAll((previous) => new Set(previous).add(activeProjectId));
      }
    }
    const frame = requestAnimationFrame(() => {
      const selected = document.querySelector('.conversation-item.is-selected');
      selected?.scrollIntoView?.({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
    // Search alone preserves folds; a selection made in results is revealed when search ends.
  }, [activeId, activeProjectId, searching]);
  const providerOf = (conversation: any) => providers.find((provider) => provider.id === conversation.providerId) || null;
  const matched = conversations.filter((conversation) => {
    if (isTemporaryConversation(conversation)) return false;
    if (!query) return true;
    const provider = providerOf(conversation);
    return [conversation.title, projects.find((project) => project.id === conversation.projectId)?.name || "", provider?.displayName || conversation.providerSnapshot?.displayName || "", conversation.model]
      .join(" ").toLowerCase().includes(query);
  });
  const preload = (conversation: any, provider: any) => {
    // Live cards contain stream-only chrome and must be painted from the
    // registry snapshot when selected. Stable conversations can be warmed
    // ahead of the click/keyboard selection without touching app state.
    if (activeStreams.has(conversation.id) || store.state.activeStreamIds?.has(conversation.id)) return;
    preloadConversationMessageHtml(conversation, {
      providerName: provider?.displayName || conversation.providerSnapshot?.displayName || "未命名供应商"
    });
  };
  const schedulePreload = (conversation: any, provider: any) => {
    if (activeStreams.has(conversation.id) || scheduledPreloads.has(conversation.id)) return;
    scheduledPreloads.add(conversation.id);
    const run = () => {
      scheduledPreloads.delete(conversation.id);
      preload(conversation, provider);
    };
    const requestIdle = (window as any).requestIdleCallback;
    if (typeof requestIdle === "function") requestIdle(run, { timeout: 600 });
    else window.setTimeout(run, 0);
  };

  const toggle = (field: "collapsedSections" | "collapsedProjectIds", key: string) => {
    const values = sidebar[field] || [];
    (store as any).actions.setSidebar({ [field]: values.includes(key) ? values.filter((value: string) => value !== key) : [...values, key] });
  };
  const glyph = (name: string, size = 16) => <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: icon(name, size) }} />;
  const renderConversation = (conversation: any) => {
      const provider = providerOf(conversation);
      return <Surface variant="interactive"
        key={conversation.id}
        data-surface="interactive" className={`conversation-item${conversation.id === activeId ? " is-selected" : ""}`}
        data-conversation-id={conversation.id}
        title={`${conversation.title || "未命名对话"} · ${conversation.model || "未选模型"}`}
        role="button"
        aria-current={conversation.id === activeId ? "page" : undefined}
        tabIndex={0}
        onPointerEnter={() => schedulePreload(conversation, provider)}
        onFocus={() => schedulePreload(conversation, provider)}
        onPointerDown={() => preload(conversation, provider)}
      >
        <div className="conv-top">
          <span className="conv-title">{conversation.title || "未命名对话"}</span>
          {activeStreams.has(conversation.id) ? <span className="conv-live" title="正在生成回复"><span className="streaming-dot"><i /><i /><i /></span></span> : null}
          {conversation.pinned ? <span className="conv-pin" dangerouslySetInnerHTML={{ __html: icon("pin", 13) }} /> : null}
        </div>
        <div className="conv-meta">
          <span>{formatRelativeDays(conversation.updatedAt, now)}</span>
          {!provider && conversation.providerSnapshot ? <span className="conv-snapshot" title="供应商已删除，使用只读快照">快照</span> : null}
        </div>
        <div className="conv-actions"><Button type="button" className="icon-btn small" data-conv-action="menu" title="更多操作" aria-label="更多操作" aria-haspopup="menu" dangerouslySetInnerHTML={{ __html: icon("more", 15) }} /></div>
      </Surface>;
  };
  const projectsOpen = Boolean(query) || !sidebar.collapsedSections?.includes("projects");
  const chatsOpen = Boolean(query) || !sidebar.collapsedSections?.includes("chats");
  const visibleProjects = projects.filter((project) => !query || project.name.toLowerCase().includes(query) || matched.some((item) => item.projectId === project.id));
  const unassigned = matched.filter((item) => !item.projectId);
  return <>
    <section className="sidebar-section" data-section="projects" aria-label="项目">
      <div className="sidebar-section-heading">
        <Button type="button" className="sidebar-section-toggle" aria-expanded={projectsOpen} onClick={() => toggle("collapsedSections", "projects")}>项目{glyph(projectsOpen ? "chevronDown" : "chevronRight", 13)}</Button>
        <Button type="button" className="icon-btn small" data-project-action="create" aria-label="新建项目" title="新建项目">{glyph("plus")}</Button>
      </div>
      {projectsOpen && <div>
        {!visibleProjects.length && <div className="empty-list-note">{query ? "没有匹配的项目" : "创建项目，整理相关聊天"}</div>}
        {visibleProjects.map((project) => {
          const items = matched.filter((item) => item.projectId === project.id);
          const open = Boolean(query) || !sidebar.collapsedProjectIds?.includes(project.id);
          const all = Boolean(query) || showAll.has(project.id);
          return <div className="sidebar-project" data-project-id={project.id} key={project.id}>
            <div className={`project-row${activeProjectId === project.id ? " is-active" : ""}`}>
              <Button type="button" className="project-toggle" title={project.name} aria-expanded={open} onClick={() => toggle("collapsedProjectIds", project.id)}>{glyph("folder")}<span className="project-name">{project.name}</span>{glyph(open ? "chevronDown" : "chevronRight", 12)}</Button>
              <ProjectSettingsButton store={store} project={project} />
              <Button type="button" className="icon-btn small" data-project-action="new-chat" aria-label={`${project.name}：新建聊天`} title="在项目内新建聊天">{glyph("edit")}</Button>
            </div>
            {open && <div className="project-conversations">
              {!items.length && <div className="empty-list-note">{query ? "没有匹配的聊天" : "暂无聊天"}</div>}
              {(all ? items : items.slice(0, 5)).map(renderConversation)}
              {!query && items.length > 5 && <Button type="button" className="project-show-more" onClick={() => setShowAll((previous) => {
                const next = new Set(previous);
                if (next.has(project.id)) next.delete(project.id); else next.add(project.id);
                return next;
              })}>{all ? "收起显示" : "展开显示"}</Button>}
            </div>}
          </div>;
        })}
      </div>}
    </section>
    <section className="sidebar-section" data-section="chats" aria-label="聊天">
      <div className="sidebar-section-heading"><Button type="button" className="sidebar-section-toggle" aria-expanded={chatsOpen} onClick={() => toggle("collapsedSections", "chats")}>聊天{glyph(chatsOpen ? "chevronDown" : "chevronRight", 13)}</Button></div>
      {chatsOpen && <div>{unassigned.length ? unassigned.map(renderConversation) : <div className="empty-list-note">{query ? "没有匹配的聊天" : "暂无无项目聊天"}</div>}</div>}
    </section>
  </>;
}
