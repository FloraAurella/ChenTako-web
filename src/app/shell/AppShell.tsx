import { Button, TextField } from "../../shared/ui/primitives";
import { icon, pearLogo } from "../../resources/icons/index.js";
import { useContributions } from "../../shared/state/contributions";
import { DialogLayer } from "../../shared/overlays/DialogLayer";
import { ConversationList } from "../../modules/chat/public/ui_ConversationList";
import type { ExternalStore } from "../../shared/state/react";
import type { SettingsService } from "../../modules/settings/public/services_settings-service";

function html(value: string) {
  return { __html: value };
}

function IconButton({
  id,
  name,
  size,
  className = "icon-btn",
  title,
  label,
  nav,
  active = false,
  expanded,
  controls
}: {
  id?: string;
  name: string;
  size: number;
  className?: string;
  title: string;
  label?: string;
  nav?: string;
  active?: boolean;
  expanded?: boolean;
  controls?: string;
}) {
  return <Button
    type="button"
    className={`${className}${active ? " is-selected is-active" : ""}`}
    id={id}
    title={title}
    aria-label={label || title}
    aria-expanded={expanded}
    aria-controls={controls}
    data-nav={nav}
    aria-current={active ? "page" : undefined}
    dangerouslySetInnerHTML={html(icon(name, size))}
  />;
}

export interface AppShellProps {
  route: { name: string; settingsSection: string; settingsProviderId?: string };
  sidebar: { archivesMode?: string; drawerOpen?: boolean; query?: string };
  conversationTitle: string;
  store: ExternalStore & { state: any };
  settings: SettingsService;
}

export function AppShell({ route, sidebar, conversationTitle, store, settings }: AppShellProps) {
  const contributions = useContributions();
  const drawerVisible = route.name === "chat" && (sidebar.archivesMode === "rail" ? sidebar.drawerOpen === true : sidebar.archivesMode !== "collapsed");
  const stageMeta = {
    chat: { eyebrow: "Chat · 对话", title: conversationTitle },
    settings: { eyebrow: "Settings · 设置", title: "设置" }
  }[route.name] || { eyebrow: "Chat · 对话", title: conversationTitle };
  return <>
    <div className="app-canvas">
      <div className="window-drag-band" aria-hidden="true" />

      <div
        className="app-shell"
        id="appShell"
        data-archives={sidebar.archivesMode || "full"}
        data-show-archives={route.name === "chat" ? "true" : "false"}
      >
        <aside className={`archive-drawer${sidebar.drawerOpen ? " drawer-open" : ""}`} id="archiveDrawer" aria-label="对话" inert={!drawerVisible}>
          <div className="drawer-head">
            <div className="drawer-brand"><span className="rail-brand" aria-hidden="true" dangerouslySetInnerHTML={html(pearLogo(18))} /><h2 className="drawer-title">Clawbox</h2></div>
            <div className="drawer-tools">
              <IconButton id="archivesCollapseBtn" name="sidebarClose" size={20} className="icon-btn" title="收起侧栏" label="收起侧栏" expanded={drawerVisible} controls="archiveDrawer" />
            </div>
          </div>
          <Button type="button" id="newConversationBtn" className="sidebar-new" dangerouslySetInnerHTML={html(`${icon("newChat", 19)}<span>新建对话</span>`)} />
          <div className="sidebar-list-heading"><span className="sidebar-search-label">查找聊天</span><IconButton id="sidebarSearchBtn" name="search" size={18} title="搜索对话" /><IconButton id="importConversationBtn" name="import" size={18} title="导入对话" /></div>
          <div className="drawer-search"><TextField id="searchInput" className="field" type="search" placeholder="搜索对话 ⌘K" autoComplete="off" /></div>
          <div className="conversation-scroll" id="conversationList"><ConversationList store={store} /></div>
          <nav className="sidebar-footer" aria-label="应用导航">
            <Button type="button" className="sidebar-settings" data-nav="settings" dangerouslySetInnerHTML={html(`${icon("settings", 17)}<span>设置</span>`)} />
          </nav>
        </aside>
        <nav className="compact-rail" aria-label="快捷导航" inert={drawerVisible || route.name !== "chat"}>
          <Button type="button" id="railExpandBtn" className="icon-btn rail-expand" title="展开侧栏" aria-label="展开侧栏" aria-expanded={drawerVisible} aria-controls="archiveDrawer">
            <span className="rail-brand-mark" dangerouslySetInnerHTML={html(pearLogo(20))} />
            <span className="rail-expand-mark" dangerouslySetInnerHTML={html(icon("sidebarOpen", 20))} />
          </Button>
          <IconButton id="railNewBtn" name="newChat" size={20} title="新建对话" />
          <IconButton id="railSearchBtn" name="search" size={20} title="搜索对话" />
          <IconButton id="railImportBtn" name="import" size={20} title="导入对话" />
          <div className="rail-spacer" />
          <IconButton name="settings" size={20} title="设置" nav="settings" />
        </nav>
        <div className={`drawer-scrim${sidebar.drawerOpen ? " visible" : ""}`} id="drawerScrim" aria-hidden="true" />

        <main className="stage" inert={drawerVisible && sidebar.archivesMode === "rail"}>
          <header className="stage-header">
            <div className="stage-leading">
              <IconButton id="drawerToggleBtn" name="sidebarOpen" size={20} title="展开侧栏（⌘\）" label="展开侧栏" expanded={drawerVisible} controls="archiveDrawer" />
              {route.name === "settings" ? <IconButton name="chevronLeft" size={19} title="返回对话" nav="chat" /> : null}
              <div className="stage-heading">
                <div className="visually-hidden" id="stageEyebrow">{stageMeta.eyebrow}</div>
                <div className="stage-title" id="stageTitle">{stageMeta.title}</div>
              </div>
            </div>
            <div className="stage-trailing"><div className="stage-actions" id="stageActions" /></div>
          </header>
          <div className="stage-body">
            {contributions.pages.list().map(page => { const Page = page.component; return <section key={page.id} id={`page-${page.id}`} className={`page ${page.id}-page${route.name === page.id ? " page-active" : ""}`} aria-label={page.label}><Page store={store} route={route} settings={settings} active={route.name === page.id} /></section>; })}
          </div>
        </main>

        <nav className="mobile-nav" aria-label="主导航" inert={drawerVisible && sidebar.archivesMode === "rail"}>
          <Button type="button" className={`mobile-nav-item${route.name === "chat" ? " is-selected is-active" : ""}`} aria-current={route.name === "chat" ? "page" : undefined} data-nav="chat" dangerouslySetInnerHTML={html(`${icon("chat", 20)}<span>对话</span>`)} />
          <Button type="button" className={`mobile-nav-item${route.name === "settings" ? " is-selected is-active" : ""}`} aria-current={route.name === "settings" ? "page" : undefined} data-nav="settings" dangerouslySetInnerHTML={html(`${icon("settings", 20)}<span>设置</span>`)} />
        </nav>
      </div>
    </div>

    <div id="popoverHost" />
    <div id="modalHost" />
    <DialogLayer />
    <div id="lightbox" role="dialog" aria-modal="true" aria-label="图片预览">
      <Button type="button" className="lightbox-close" id="lightboxClose" aria-label="关闭预览" dangerouslySetInnerHTML={html(icon("close", 18))} />
      <figure className="lightbox-stage"><img id="lightboxImage" alt="" /><figcaption className="lightbox-caption" id="lightboxCaption" /></figure>
    </div>
  </>;
}
