import { projectName } from '../domain/model.js';
import { createId } from '../../../contracts/normalize.js';
export function createProjectState({state,persistSoon,notify,validProjectId,revealConversation,activeConversation,canModifyConversation = () => true}) {
  function createProject(name) {
    const normalizedName = projectName(name);
    if (!normalizedName) throw new Error("项目名称不能为空");
    const project = { id: createId(), name: normalizedName, configOverrides: {}, createdAt: Date.now() };
    state.projects = [...state.projects, project];
    persistSoon();
    notify("project-created");
    return project;
  }

  function renameProject(id, name) {
    const normalizedName = projectName(name);
    if (!normalizedName) throw new Error("项目名称不能为空");
    const project = state.projects.find((item) => item.id === id);
    if (!project) return;
    project.name = normalizedName;
    persistSoon();
    notify("project-renamed");
  }

  function moveConversationToProject(id, projectId) {
    const conversation = state.conversations.find((item) => item.id === id);
    if (!conversation) return;
    if (!canModifyConversation(conversation)) throw new Error("首次响应尚未结束，请等待完成或停止生成后再修改对话。");
    conversation.projectId = validProjectId(projectId);
    if (id === state.activeConversationId) revealConversation(id);
    persistSoon();
    notify("project-moved");
  }

  function deleteProject(id) {
    if (state.conversations.some(c => c.projectId === id && !canModifyConversation(c))) throw new Error("项目内有对话首次响应尚未结束，请等待完成或停止生成后再删除项目。");
    const revealActive = activeConversation()?.projectId === id;
    state.projects = state.projects.filter((project) => project.id !== id);
    state.conversations.forEach((conversation) => {
      if (conversation.projectId === id) conversation.projectId = null;
    });
    state.sidebar = { ...state.sidebar, collapsedProjectIds: state.sidebar.collapsedProjectIds.filter((key) => key !== id) };
    if (revealActive) revealConversation(state.activeConversationId);
    persistSoon();
    notify("project-deleted");
  }

return {createProject,renameProject,moveConversationToProject,deleteProject};
}
