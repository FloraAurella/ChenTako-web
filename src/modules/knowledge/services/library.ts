import { normalizeLibraries, validateLibrary, type KnowledgeFile } from '../domain/library';

/** All entry points share an atomic in-memory replacement followed by existing archive persistence. */
export async function saveLibrary(store: any, projectId: string, files: KnowledgeFile[]) {
  if (!store.state.projects.some((project: any) => project.id === projectId)) throw new Error('项目已删除，未保存资料。');
  validateLibrary(files, true);
  const libraries = normalizeLibraries(store.state.projectKnowledge, store.state.projects);
  libraries[projectId] = structuredClone(files);
  store.state.projectKnowledge = libraries;
  store.notify('knowledge');
  if (!(await store.persist())) throw new Error('资料仅保留在当前页面，持久化失败。请立即导出备份，勿刷新页面。');
}
