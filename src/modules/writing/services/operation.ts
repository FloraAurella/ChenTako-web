import { promptText } from "../../../resources/public/prompts.js";
import type { RequestOperation } from '../../../contracts/request-context';
import { type Work } from '../domain/work';
import { writingService } from './work';

export function createWritingOperation({ store, conversation }: { store: any; conversation: any }): RequestOperation | null {
  const work: Work | undefined = conversation.writing;
  if (!work || work.mode === 'chat') return null;
  const service = writingService(store); const id = conversation.id;
  if (work.error) throw new Error(work.error);
  if (!work.selectedId) throw new Error('请先 /create 章名 创建章节，或用 @章名 选择章节。当前模式会保持。');
  const chapterId = work.selectedId; const c = service.chapter(id, chapterId);
  if (work.mode === 'edit' && !c.body.trim()) throw new Error('本章尚无正文，请先写作或手动填写。当前模式会保持。');
  const r = service.runtime(id);
  if (r.editing) throw new Error('请先保存或取消手动编辑。');
  const version = work.revision; const projectId = conversation.projectId;
  const knowledge = JSON.stringify(store.state.projectKnowledge?.[projectId] || []);
  let versionId = ''; let requirement = ''; let disposed = false;
  const validate = () => {
    if (disposed || !store.state.conversations.includes(conversation)) throw new Error('对话已失效。');
    if (conversation.writing.revision !== version || conversation.projectId !== projectId || JSON.stringify(store.state.projectKnowledge?.[projectId] || []) !== knowledge) throw new Error('章节或项目资料已变化，请重新发送。');
  };
  return {
    outputSurface: 'workspace',
    historyText: '本轮正文已写入右侧工作区，当前版本以作品上下文为准。',
    async prepare({ signal, message }) {
      if (signal.aborted) throw new DOMException('已停止', 'AbortError');
      promptText(work.mode, true);
      requirement = message?.content || '';
      r.locks.add(chapterId); r.notice = '正在写入正文…'; service.notify(id);
    },
    validate,
    start() { validate(); versionId = service.beginBody(id, chapterId, requirement); },
    update(text) { if (!disposed && versionId) service.updateBody(id, chapterId, versionId, text); },
    finish({ text, complete }) {
      if (disposed) return;
      if (versionId) service.updateBody(id, chapterId, versionId, text, complete && text.trim() ? 'complete' : 'incomplete');
      r.notice = complete && text.trim() ? '正文已写入，可用版本箭头回档。' : '本次写入未完整结束；已保留收到的内容和此前版本。';
    },
    dispose() { if (disposed) return; disposed = true; r.locks.delete(chapterId); service.notify(id); }
  };
}
