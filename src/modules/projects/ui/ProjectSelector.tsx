import { Button } from "../../../shared/ui/primitives";
import { icon } from "../../../resources/icons/index.js";
import { useStoreValue, type ExternalStore } from "../../../shared/state/react";

export function ProjectSelector({ store }: { store: ExternalStore & { state: any } }) {
  const projects = useStoreValue<any[]>(store, "projects");
  const conversations = useStoreValue<any[]>(store, "conversation-list");
  const selected = conversations.find((item) => item.id === store.state.activeConversationId);
  const current = useStoreValue<any>(store, `conversation:${selected?.id || ""}`);
  const name = projects.find((project) => project.id === current?.projectId)?.name || "无项目";
  return <div className="composer-project-row" hidden={!current || current.messages.length > 0}>
    <Button type="button" id="projectSelectorBtn" className="project-selector-btn" aria-label={`当前项目：${name}`} title={`当前项目：${name}`} aria-haspopup="menu" disabled={!current}>
      <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: icon("folder", 16) }} />
      <span className="project-name">{name}</span>
      <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: icon("chevronDown", 12) }} />
    </Button>
  </div>;
}
