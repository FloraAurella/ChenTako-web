import { TrustedIcon } from '../../../shared/ui/Icon';
import { LIMITS } from '../../../contracts/constants.js';
import { useEffect, useRef, useState } from 'react';
import { Button, IconButton, Disclosure, FieldGroup, ListItem, StatusText, Surface, TextArea, TextField } from '../../../shared/ui/primitives';
import { useStoreSnapshot } from '../../../shared/state/react';
import { writingService } from '../services/work';
import { normalizeWork, type Work } from '../domain/work';

const labels = { chat: '讨论', write: '写作', edit: '编辑' };
export function WritingStatus({ store }: { store: any }) {
  useStoreSnapshot(store, 'app');
  const c = store.activeConversation(); const w: Work | undefined = c?.writing;
  if (!w) return null;
  const service = writingService(store); const r = service.runtime(c.id);
  const chapter = w.chapters.find(ch => ch.id === w.selectedId);
  return <div className="writing-status"><StatusText>{labels[w.mode]} · {chapter?.name || '未选章节'}{r.locks.size ? ' · 处理中' : ''}</StatusText>
    </div>;
}

function useMobileWorkspace() {
  const [mobile, setMobile] = useState(() => window.matchMedia?.('(max-width: 760px)').matches ?? false);
  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 760px)');
    if (!media) return;
    const update = () => setMobile(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return mobile;
}
export function WritingSidebarButton({ store }: { store: any }) {
  useStoreSnapshot(store, 'app');
  const mobile = useMobileWorkspace();
  const c = store.activeConversation();
  if (!c?.writing) return null;
  const service = writingService(store);
  const open = mobile ? service.runtime(c.id).mobile : !c.writing.collapsed;
  return <IconButton id="writingSidebarToggle" className="icon-btn" aria-label="右边栏"
    title={open ? '收起右边栏' : '展开右边栏'} aria-expanded={open} aria-controls="writingWorkspace"
    onClick={() => service.togglePanel(c.id, mobile)}><TrustedIcon name="sidebarRight" size={20} /></IconButton>;
}

export function WritingPane({ store }: { store: any }) {
  useStoreSnapshot(store, 'app');
  const c = store.activeConversation();
  if (!c?.writing) return null;
  return <WorkPane key={c.id} store={store} conversation={c} />;
}
function WorkPane({ store, conversation }: { store: any; conversation: any }) {
  const service = writingService(store); const id = conversation.id;
  const w: Work = service.work(id); const r = service.runtime(id);
  const selected = w.chapters.find(c => c.id === w.selectedId);
  const mobile = useMobileWorkspace();
  const open = mobile ? r.mobile : !w.collapsed;
  const [deleting, setDeleting] = useState(false);
  const [editor, setEditor] = useState<{ chapterId: string; text: string } | null>(null);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [pendingImport, setPendingImport] = useState<Work | null>(null);
  const editorRef = useRef(editor); editorRef.current = editor; r.editing = !!editor;
  useEffect(() => { setDeleting(false); }, [selected?.id, selected?.name]);
  useEffect(() => {
    if (!editor) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [editor]);
  // Flush the owning chapter on a conversation switch, never the newly selected conversation.
  useEffect(() => () => {
    r.editing = false;
    const pending = editorRef.current;
    if (pending && store.state.conversations.includes(conversation)) {
      try { service.saveBody(id, pending.chapterId, pending.text); }
      catch (error) { r.unsaved = true; r.notice = error instanceof Error ? error.message : '正文未保存。'; }
    }
  }, [service, id, store, conversation, r]);
  function act(fn: () => void) { try { fn(); setError(''); } catch (e) { setError(e instanceof Error ? e.message : '操作失败。'); } }
  function exportBackup() {
    const blob = new Blob([JSON.stringify({ kind: 'chentako-writing', version: 1, requires: 'ChenTako writing workspace v2', writing: w }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'ChenTako-作品备份.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  const locked = Boolean(selected && r.locks.has(selected.id));
  const versionIndex = selected ? selected.versions.findIndex(v => v.id === selected.currentVersionId) : -1;
  const currentVersion = selected?.versions[versionIndex];
  return <aside className={`writing-pane${r.mobile ? ' is-mobile-open' : ''}${w.collapsed ? ' is-collapsed' : ''}`} id="writingWorkspace" aria-label="章节编辑器" aria-hidden={!open} inert={!open}>
    <div className="writing-toolbar"><h2>写入工作区</h2><Button className="btn btn-ghost" onClick={exportBackup}>导出作品备份</Button></div>
    <StatusText role="status">{r.saving ? '正在保存…' : r.unsaved ? '未保存' : '已保存到本机'}</StatusText>
    <p className="field-help">章节归当前对话所有，写作和编辑直接保存为正文版本。</p>
    <Disclosure label="恢复作品备份"><FieldGroup id="writing-import" label="选择作品 JSON 备份"><TextField className="field" id="writing-import" type="file" accept=".json,application/json" disabled={!!editor || !!r.locks.size} onChange={async e => {
      const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
      try {
        if (file.size > LIMITS.importBytes) throw new Error('备份超过导入上限，请使用较小的作品备份。');
        const text = await file.text(); if (!mounted.current) return;
        const data = JSON.parse(text); const restored = normalizeWork(data.writing);
        if (data.kind !== 'chentako-writing' || data.version !== 1 || !restored || restored.error) throw new Error('作品备份格式不正确或版本不兼容。');
        setPendingImport(restored); setError('');
      } catch (error) { if (mounted.current) setError(error instanceof Error ? error.message : '备份读取失败。'); }
    }} /></FieldGroup>
      {pendingImport && <Surface><p>用备份中的 {pendingImport.chapters.length} 章替换当前作品？请先导出当前作品备份。</p><Button className="btn btn-ghost" onClick={() => act(() => { service.restoreBackup(id, pendingImport); setPendingImport(null); })}>确认恢复作品</Button><Button className="btn btn-ghost" onClick={() => setPendingImport(null)}>取消恢复</Button></Surface>}
    </Disclosure>
    {(error || w.error) && <p role="alert">{error || w.error}</p>}
    {r.notice && <Surface className="writing-notice"><p role="status">{r.notice}</p><Button className="btn btn-ghost" onClick={() => { r.notice = ''; service.notify(id); }}>收起提示</Button></Surface>}
    {r.unsaved && <Button className="btn btn-ghost" onClick={() => void service.save(id)}>重试保存</Button>}
    {!w.error && <>
      <nav className="writing-chapters" aria-label="章节列表">{w.chapters.map((chapter, i) => <ListItem className="btn" key={chapter.id} aria-current={chapter.id === w.selectedId ? 'true' : undefined} disabled={!!editor} onClick={() => act(() => service.select(id, chapter.id))}><span>{i + 1}. {chapter.name}</span><StatusText>{r.locks.has(chapter.id) ? '写入中' : `${chapter.versions.length} 个版本`}</StatusText></ListItem>)}</nav>
      {!selected ? <p>选择章节，或输入 /create 章名 创建。</p> : <>
        <div className="writing-toolbar"><Button className="btn btn-ghost" disabled={locked || !!editor || w.chapters[0] === selected} onClick={() => act(() => service.move(id, selected.id, -1))}>上移</Button><Button className="btn btn-ghost" disabled={locked || !!editor || w.chapters.at(-1) === selected} onClick={() => act(() => service.move(id, selected.id, 1))}>下移</Button><Button className="btn btn-ghost" disabled={locked || !!editor} onClick={() => setDeleting(true)}>删除章节</Button></div>
        {deleting && <Surface><p>删除「{selected.name}」及其全部版本？此操作不能撤销。</p><Button className="btn btn-ghost" onClick={() => act(() => { service.remove(id, selected.id); setDeleting(false); })}>确认删除</Button><Button className="btn btn-ghost" onClick={() => setDeleting(false)}>取消</Button></Surface>}
        <Surface className="writing-document">
          <h3>{selected.name}</h3>
          {currentVersion?.requirement && <p className="writing-request">{currentVersion.requirement}</p>}
          <div className="writing-version-nav" aria-label="正文版本切换">
            <Button className="branch-nav-btn" aria-label="上一版本" disabled={locked || !!editor || versionIndex <= 0} onClick={() => act(() => service.selectVersion(id, selected.id, selected.versions[versionIndex - 1].id))}><TrustedIcon name="chevronLeft" size={15} /></Button>
            <StatusText>{versionIndex < 0 ? 0 : versionIndex + 1} / {selected.versions.length}</StatusText>
            <Button className="branch-nav-btn" aria-label="下一版本" disabled={locked || !!editor || versionIndex >= selected.versions.length - 1} onClick={() => act(() => service.selectVersion(id, selected.id, selected.versions[versionIndex + 1].id))}><TrustedIcon name="chevronRight" size={15} /></Button>
          </div>
          <StatusText>{locked ? '正在写入…' : currentVersion?.status === 'incomplete' ? '本次未完整结束，内容已保留，可继续编辑或回档' : selected.body ? '正文已保存' : '等待写入正文'}</StatusText>
          <pre data-testid="writing-body">{selected.body}</pre>
          <Button className="btn btn-ghost" disabled={locked || !!editor} onClick={() => setEditor({ chapterId: selected.id, text: selected.body })}>手动编辑</Button>
        </Surface>
        {editor && <Surface><FieldGroup id="writing-editor" label="编辑正文"><TextArea className="field" id="writing-editor" rows={12} value={editor.text} onChange={e => setEditor({ ...editor, text: e.target.value })} /></FieldGroup><Button className="btn btn-ghost" onClick={() => act(() => { service.saveBody(id, editor.chapterId, editor.text); setEditor(null); })}>保存正文</Button><Button className="btn btn-ghost" onClick={() => setEditor(null)}>取消编辑</Button></Surface>}
        <Disclosure label={`版本记录（${selected.versions.length}）`}>
          {[...selected.versions].reverse().map(v => <div className="writing-version" key={v.id}><StatusText>{new Date(v.createdAt).toLocaleString()} · {v.source}{v.status !== 'complete' ? ' · 未完整结束' : ''}</StatusText><Disclosure label="查看正文"><pre>{v.text}</pre></Disclosure><Button className="btn btn-ghost" disabled={locked || !!editor} onClick={() => act(() => service.selectVersion(id, selected.id, v.id))}>恢复此版本</Button></div>)}
        </Disclosure>
      </>}
    </>}
  </aside>;
}
