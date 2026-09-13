import { chapterName, newId, newWork, normalizeWork, upgradeWorkspace, revision, type Chapter, type Work, type WritingMode } from '../domain/work';

export interface WorkRuntime { locks: Set<string>; notice: string; unsaved: boolean; saving: boolean; mobile: boolean; editing?: boolean }
const services = new WeakMap<object, ReturnType<typeof buildService>>();
export function writingService(store: any) {
  let service = services.get(store);
  if (!service) { service = buildService(store); services.set(store, service); }
  return service;
}
function buildService(store: any) {
  const runtimes = new Map<string, WorkRuntime>();
  let saveVersion = 0;
  const runtime = (id: string): WorkRuntime => {
    if (!runtimes.has(id)) runtimes.set(id, { locks: new Set(), notice: '', unsaved: false, saving: false, mobile: false });
    return runtimes.get(id)!;
  };
  const notify = (id: string) => store.notify('writing', ['app', 'composer', 'conversation-list', `conversation:${id}`]);
  const conversation = (id: string) => {
    const c = store.state.conversations.find((c: any) => c.id === id);
    if (!c) throw new Error('对话已删除。');
    return c;
  };
  const work = (id: string): Work => {
    const c = conversation(id);
    if (c.writing?.error) throw new Error(c.writing.error);
    return upgradeWorkspace(c.writing || (c.writing = newWork()));
  };
  async function save(id: string) {
    const version = ++saveVersion;
    const r = runtime(id); r.saving = true; notify(id);
    let ok = false;
    try { ok = await store.persist(); } catch { /* retained in memory, reported below */ }
    if (version !== saveVersion) return;
    // persist() writes the entire state; all pending works share this durability result.
    for (const [key, state] of runtimes) {
      state.saving = false; state.unsaved = !ok;
      if (!ok) state.notice = '尚未保存到本机，请导出作品备份，勿刷新页面。';
      notify(key);
    }
  }
  const changed = (id: string, content = true) => {
    const c = conversation(id);
    if (content) work(id).revision++;
    c.updatedAt = Date.now(); notify(id); void save(id);
  };
  const chapter = (id: string, chapterId: string, writable = true): Chapter => {
    const c = work(id).chapters.find(c => c.id === chapterId);
    if (!c) throw new Error('章节已不存在。');
    if (writable && runtime(id).locks.has(chapterId)) throw new Error('本章正在检查或生成，请先停止或等待完成。');
    return c;
  };
  const allowSelection = (id: string) => { if (runtime(id).editing) throw new Error('请先保存或取消手动编辑。'); };
  const replaceCandidate = (c: Chapter, next: Chapter['candidate']) => {
    if (c.candidate) c.drafts.push(structuredClone(c.candidate));
    c.candidate = next; c.revision++;
  };
  return {
    runtime, notify, conversation, work, chapter, changed, save,
    togglePanel(id: string, mobile = false) { const w = work(id); const r = runtime(id); if (mobile) r.mobile = !r.mobile; else w.collapsed = !w.collapsed; changed(id, false); },
    saveBody(id: string, chapterId: string, text: string) {
      const c = chapter(id, chapterId);
      const v = revision(text, '手动编辑'); c.versions.push(v); c.body = text; c.currentVersionId = v.id; c.revision++; changed(id);
    },
    selectVersion(id: string, chapterId: string, versionId: string) {
      const c = chapter(id, chapterId); const v = c.versions.find(v => v.id === versionId);
      if (!v) throw new Error('版本不存在。');
      c.body = v.text; c.currentVersionId = v.id; c.revision++; changed(id);
    },
    beginBody(id: string, chapterId: string, requirement: string) {
      const c = chapter(id, chapterId, false);
      if (c.body && !c.versions.some(v => v.text === c.body)) c.versions.push(revision(c.body, '原正文'));
      const v = { ...revision('', work(id).mode === 'edit' ? 'AI 编辑' : 'AI 写作', 'generating'), requirement };
      c.versions.push(v); c.currentVersionId = v.id; c.revision++; changed(id); return v.id;
    },
    updateBody(id: string, chapterId: string, versionId: string, text: string, status?: 'complete' | 'incomplete') {
      const conv = store.state.conversations.find((c: any) => c.id === id);
      const c: Chapter | undefined = conv?.writing?.chapters.find((c: Chapter) => c.id === chapterId);
      const v = c?.versions.find(v => v.id === versionId);
      if (!c || !v || c.currentVersionId !== versionId) return;
      v.text = text;
      // A failure before the first token must not blank the existing chapter.
      if (text) c.body = text;
      if (status) {
        v.status = status;
        if (!text) c.currentVersionId = [...c.versions].reverse().find(old => old.id !== v.id && old.text === c.body)?.id;
        c.revision++; changed(id);
      } else { notify(id); store.persistSoon(); }
    },
    create(id: string, value: string) {
      allowSelection(id);
      const name = chapterName(value); const w = work(id);
      if (w.chapters.some(c => c.name === name)) throw new Error('章名已存在，请选择该章或使用不同名称。');
      const c: Chapter = { id: newId(), name, revision: 0, body: '', candidate: null, versions: [], drafts: [] };
      w.chapters.push(c); w.selectedId = c.id;
      const conv = conversation(id); conv.isTemporary = false;
      if (!conv.title) conv.title = name;
      changed(id); return c;
    },
    select(id: string, chapterId: string) { allowSelection(id); chapter(id, chapterId, false); if (work(id).selectedId !== chapterId) { work(id).selectedId = chapterId; changed(id); } },
    mode(id: string, mode: WritingMode) { allowSelection(id); const conv = conversation(id); const existed = !!conv.writing; const w = work(id); conv.isTemporary = false; if (w.mode !== mode || !existed) { w.mode = mode; changed(id); } },
    restoreBackup(id: string, value: unknown) {
      allowSelection(id);
      if (runtime(id).locks.size) throw new Error('请先停止或等待请求完成。');
      const restored = normalizeWork(value);
      if (!restored || restored.error) throw new Error('备份格式不正确或资料不完整，原作品未修改。');
      const conv = conversation(id);
      conv.writing = restored; conv.isTemporary = false; changed(id);
    },
    rename(id: string, chapterId: string, value: string) {
      allowSelection(id);
      const c = chapter(id, chapterId); const name = chapterName(value);
      if (work(id).chapters.some(other => other.id !== c.id && other.name === name)) throw new Error('章名已存在。');
      c.name = name; c.revision++; changed(id);
    },
    move(id: string, chapterId: string, offset: number) {
      chapter(id, chapterId); const w = work(id); const i = w.chapters.findIndex(c => c.id === chapterId); const next = i + offset;
      if (next < 0 || next >= w.chapters.length) return;
      [w.chapters[i], w.chapters[next]] = [w.chapters[next], w.chapters[i]]; changed(id);
    },
    remove(id: string, chapterId: string) {
      chapter(id, chapterId); const w = work(id); w.chapters = w.chapters.filter(c => c.id !== chapterId);
      if (w.selectedId === chapterId) w.selectedId = null; changed(id);
    },
    draft(id: string, chapterId: string, text: string) {
      const c = chapter(id, chapterId); replaceCandidate(c, revision(text, '手动编辑')); changed(id);
    },
    discard(id: string, chapterId: string) { replaceCandidate(chapter(id, chapterId), null); changed(id); },
    accept(id: string, chapterId: string) {
      const c = chapter(id, chapterId);
      if (!c.candidate?.text.trim() || c.candidate.status !== 'complete') throw new Error('请等待完整生成，或先手动整理并保存草稿。');
      c.body = c.candidate.text; c.versions.push(revision(c.body, '采纳')); replaceCandidate(c, null); changed(id);
    },
    restore(id: string, chapterId: string, revisionId: string, candidate = false) {
      const c = chapter(id, chapterId); const old = (candidate ? c.drafts : c.versions).find(v => v.id === revisionId);
      if (!old) throw new Error('版本不存在。');
      if (candidate) replaceCandidate(c, revision(old.text, '恢复候选稿', old.status === 'generating' ? 'incomplete' : old.status));
      else { c.body = old.text; c.versions.push(revision(old.text, '恢复正式版本')); c.revision++; }
      changed(id);
    },
    begin(id: string, chapterId: string) {
      const c = chapter(id, chapterId, false); replaceCandidate(c, revision('', 'AI 生成', 'generating')); changed(id); return c.candidate!.id;
    },
    update(id: string, chapterId: string, candidateId: string, text: string, status?: 'complete' | 'incomplete') {
      const conv = store.state.conversations.find((c: any) => c.id === id);
      const c = conv?.writing?.chapters.find((c: Chapter) => c.id === chapterId);
      if (!c || c.candidate?.id !== candidateId) return;
      c.candidate.text = text;
      if (status) { c.candidate.status = status; changed(id); }
      else { notify(id); store.persistSoon(); }
    }
  };
}
