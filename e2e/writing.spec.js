// 2026-09-13 用户要求改为直接正文工作区；保留并扩展原有保存、预算、取消、隔离及布局覆盖。
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const provider={id:'a',displayName:'模拟供应商',baseUrl:'https://example.com/v1',responseFormat:'openai-compatible',models:['m'],defaultModel:'m',contextWindow:131072,maxTokens:8192,hasKeyConfigured:true};
async function load(page, scheme='light', streaming=false){
 await page.addInitScript(({provider,scheme,streaming})=>{
 if(sessionStorage.getItem('workspace-seed'))return;sessionStorage.setItem('workspace-seed','1');
 localStorage.setItem('tribblebook-v6-state',JSON.stringify({settingsSchemaVersion:2,chatConfig:{streaming,compressionThreshold:99},providers:[provider],projects:[],activeProviderId:'a',activeConversationId:'c',conversations:[{id:'c',providerId:'a',model:'m',messages:[],saveChats:true},{id:'other',providerId:'a',model:'m',title:'另一部作品',messages:[],saveChats:true}]}));
 localStorage.setItem('tribblebook-ui-preferences-v1',JSON.stringify({themeId:'tako-festival',appearanceMode:scheme}));
 },{provider,scheme,streaming});
 await page.route('**/src/resources/public/prompts.js*',r=>r.fulfill({contentType:'application/javascript',body:'export function promptText(name) { return "测试提示词 " + name; }'}));
 await page.route('**/api/health',r=>r.fulfill({json:{ok:true}}));await page.route('**/api/providers',r=>r.fulfill({json:{providers:[]}}));
 await page.route('**/api/providers/key*',r=>r.fulfill({json:{apiKey:'mock-only'}}));await page.route('**/api/chat/title',r=>r.fulfill({json:{title:'测试作品'}}));
 await page.goto('/#/chat');await expect(page.locator('#composerInput')).toBeEnabled();
}
const send=async(page,text)=>{await page.locator('#composerInput').fill(text);await page.locator('#sendBtn').click();};
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('tribblebook-v6-state')).conversations.find(c=>c.id==='c'));
const reply=content=>({content,reasoning:'',images:[],finishReason:'stop'});
async function manual(page,text){await page.getByRole('button',{name:'手动编辑',exact:true}).click();await page.getByLabel('编辑正文',{exact:true}).fill(text);await page.getByRole('button',{name:'保存正文',exact:true}).click();}

test('直接模式切换、持续写作、左右分流、回档和刷新',async({page})=>{
 const requests=[];await page.route('**/api/chat',r=>{requests.push(r.request().postDataJSON());return r.fulfill({json:reply(`结果${requests.length}`)});});
 await load(page);await send(page,'/create Chapter6');
 await page.locator('#composerInput').fill('/w');await page.getByRole('option',{name:/写作/}).click();
 await expect(page.locator('#composerInput')).toHaveValue('');await expect(page.locator('.writing-status')).toContainText('写作');expect(requests).toHaveLength(0);
 await send(page,'随便写个章节');await expect(page.getByTestId('writing-body')).toHaveText('结果1');
 await send(page,'再改一稿');await expect(page.getByTestId('writing-body')).toHaveText('结果2');expect(requests).toHaveLength(2);
 await expect(page.locator('#messageList')).not.toContainText('结果');await expect(page.locator('#messageList')).not.toContainText('随便写个章节');
 await expect(page.locator('.writing-version-nav')).toContainText('2 / 2');
 await page.getByRole('button',{name:'上一版本',exact:true}).click();await expect(page.getByTestId('writing-body')).toHaveText('结果1');
 await send(page,'/edit 从这一版改');await expect(page.getByTestId('writing-body')).toHaveText('结果3');expect(requests[2].chatConfig.systemPrompt).toContain('结果1');
 await send(page,'/chat 讨论下一章');await expect(page.locator('#messageList')).toContainText('结果4');await expect(page.locator('#messageList')).toContainText('讨论下一章');await expect(page.getByTestId('writing-body')).toHaveText('结果3');
 await page.reload();await expect(page.getByTestId('writing-body')).toHaveText('结果3');await expect(page.locator('.writing-status')).toContainText('讨论');await expect(page.locator('#messageList')).not.toContainText('结果1');
 await expect(page.getByRole('button',{name:'采纳正文',exact:true})).toHaveCount(0);
});

test('全文上下文只改目标章、保留附件和宽松正文格式',async({page})=>{
 const requests=[];const text='说明\n```markdown\n# 第六章\n保留原样 / @ {"a":1}\n```';
 await page.route('**/api/chat',r=>{requests.push(r.request().postDataJSON());return r.fulfill({json:reply(text)});});await load(page);
 for(const n of [5,6,7]){await send(page,`/create Chapter${n}`);await manual(page,`正式${n}`);}
 await page.locator('#attachmentInput').setInputFiles({name:'参考.txt',mimeType:'text/plain',buffer:Buffer.from('附件全文')});
 await send(page,'@Chapter6');await send(page,'/edit');expect(requests).toHaveLength(0);
 await send(page,'修改这章');await expect(page.getByTestId('writing-body')).toHaveText(text);
 expect(requests).toHaveLength(1);for(const n of [5,6,7])expect(requests[0].chatConfig.systemPrompt).toContain(`正式${n}`);
 expect(JSON.stringify(requests[0])).toContain('附件全文');expect((await stored(page)).writing.chapters.map(c=>c.body)).toEqual(['正式5',text,'正式7']);
});

test('停止保留部分正文和历史版本，正文不进入左侧',async({page})=>{
 await load(page,'light',true);await send(page,'/create 一章');await manual(page,'上一版本');
 await page.route('**/api/chat',r=>r.fulfill({contentType:'text/event-stream',body:'event: chat.stream.started\ndata: {"version":1,"providerId":"a","reasoningKind":"thinking"}\n\nevent: chat.content.delta\ndata: {"delta":"部分正文"}\n\n'}));
 await send(page,'/write 新写');await expect(page.getByTestId('writing-body')).toHaveText('部分正文');await expect(page.locator('.writing-document')).toContainText('未完整结束');
 await page.getByRole('button',{name:'上一版本',exact:true}).click();await expect(page.getByTestId('writing-body')).toHaveText('上一版本');await expect(page.locator('#messageList')).not.toContainText('部分正文');
 await expect(page.locator('.writing-status')).toContainText('写作');
});

test('请求切换会话后仍归原作品，返回后版本可恢复',async({page})=>{
 let release;await page.route('**/api/chat',async r=>{await new Promise(resolve=>{release=resolve;});await r.fulfill({json:reply('原作品内容')});});
 await load(page);await send(page,'/create 原章');await send(page,'/write 要求');await expect.poll(()=>Boolean(release)).toBe(true);
 await page.locator('[data-conversation-id="other"]').first().click();release();
 await expect.poll(async()=> (await stored(page)).writing.chapters[0].body).toBe('原作品内容');await expect(page.locator('#messageList')).not.toContainText('原作品内容');
 await page.locator('[data-conversation-id="c"]').first().click();await expect(page.getByTestId('writing-body')).toHaveText('原作品内容');await expect(page.locator('.writing-status')).toContainText('写作');
});

for(const scheme of ['light','dark'])for(const width of [1280,1024,390])test(`工作区可收起 ${scheme} ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});await load(page,scheme);await send(page,'/create 雨夜');
 if(width===390)await page.getByRole('button',{name:'右边栏',exact:true}).click();
 await expect(page.locator('.writing-pane')).toBeVisible();await manual(page,'工作区正文');
 await page.getByRole('button',{name:'右边栏',exact:true}).click();await expect(page.locator('.writing-pane')).toBeHidden();await expect(page.locator('#composerInput')).toBeVisible();
 if(width!==390){await page.reload();await expect(page.locator('.writing-pane')).toBeHidden();}
 await page.getByRole('button',{name:'右边栏',exact:true}).click();await expect(page.getByTestId('writing-body')).toHaveText('工作区正文');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(page.locator('.writing-pane')).toHaveCSS('opacity', '1');
 await expect(page.locator('.writing-pane')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
 mkdirSync('reports/writing-sidebar-2026-09-13',{recursive:true});await page.screenshot({path:`reports/writing-sidebar-2026-09-13/${scheme}-${width}.png`});
});

test('独立作品备份恢复和损坏备份拒绝', async ({ page }) => {
  await load(page); await send(page, '/create Chapter6'); await manual(page, '备份正文');
  const work = (await stored(page)).writing;
  await page.getByText('恢复作品备份', { exact: true }).click();
  await page.getByLabel('选择作品 JSON 备份').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"kind":"chentako-writing","version":1,"writing":{"version":99}}') });
  await expect(page.getByRole('alert')).toContainText('备份格式');
  await page.getByLabel('选择作品 JSON 备份').setInputFiles({ name: 'work.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ kind: 'chentako-writing', version: 1, writing: work })) });
  await page.getByRole('button', { name: '确认恢复作品', exact: true }).click();
  await expect(page.locator('.writing-document').first()).toContainText('备份正文');
});

test('全部正文超预算时不调用检查模型且不截断作品', async ({ page }) => {
  let count = 0; await page.route('**/api/chat', route => { count++; return route.fulfill({ json: reply('不应生成') }); });
  await load(page); await send(page, '/create 长篇');
  const text = '长篇资料'.repeat(70000); await manual(page, text);
  await send(page, '/write 下一稿');
  await expect(page.locator('.composer-inline-error')).toContainText('预算');
  await expect(page.locator('#composerInput')).toHaveValue('/write 下一稿');
  expect(count).toBe(0); expect((await stored(page)).writing.chapters[0].body).toBe(text);
});

test('持久化失败明确显示未保存，内存正文可导出', async ({ page }) => {
  await load(page); await send(page, '/create Chapter6'); await expect(page.locator('.writing-pane')).toContainText('已保存到本机');
  await page.evaluate(() => {
    Storage.prototype.setItem = () => { throw new DOMException('quota', 'QuotaExceededError'); };
    indexedDB.open = () => { throw new Error('模拟 IndexedDB 不可用'); };
  });
  await manual(page, '必须保留的正文');
  await expect(page.locator('.writing-pane')).toContainText('尚未保存到本机');
  await expect(page.locator('.writing-document').first()).toContainText('必须保留的正文');
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: '导出作品备份', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('ChenTako-作品备份.json');
});

test('手动草稿随原对话保存，模式不能打断尚未提交的编辑', async ({ page }) => {
  await load(page); await send(page, '/create Chapter6');
  await page.getByRole('button', { name: '手动编辑', exact: true }).click(); await page.getByLabel('编辑正文', { exact: true }).fill('切换前的手动草稿');
  await send(page, '/write'); await expect(page.locator('.command-feedback')).toContainText('先保存或取消');
  await page.locator('[data-conversation-id="other"]').first().click();
  await page.locator('[data-conversation-id="c"]').first().click(); await expect(page.getByTestId('writing-body')).toHaveText('切换前的手动草稿');
});


test('@补全、重复章名、缺失章节及模式错误不丢失附件',async({page})=>{
 let count=0;await page.route('**/api/chat',r=>{count++;return r.fulfill({json:reply('不应调用')});});await load(page);
 await page.locator('#attachmentInput').setInputFiles({name:'参考.txt',mimeType:'text/plain',buffer:Buffer.from('参考资料')});
 await send(page,'/create "雨夜 重逢"');await send(page,'/create Chapter7');
 await page.locator('#composerInput').fill('@雨夜');await page.locator('#composerInput').press('Tab');await expect(page.locator('#composerInput')).toHaveValue('@"雨夜 重逢"');await page.locator('#sendBtn').click();
 await send(page,'/create "雨夜 重逢"');await expect(page.locator('.command-feedback')).toContainText('已存在');
 await send(page,'@不存在');await expect(page.locator('.command-feedback')).toContainText('没有找到');
 await send(page,'/edit 修改空章');await expect(page.locator('.writing-status')).toContainText('编辑');expect(count).toBe(0);await expect(page.locator('#composerChips')).toContainText('参考.txt');
 await page.locator('[data-conversation-id="other"]').first().click();await send(page,'/create 另一章');await expect(page.getByRole('navigation',{name:'章节列表'})).not.toContainText('雨夜');
});

async function liveStream(page){
 await page.evaluate(()=>{
 const original=window.fetch;window.fetch=async(url,options)=>{
 if(String(url)!=='/api/chat')return original(url,options);
 const encoder=new TextEncoder();return new Response(new ReadableStream({start(controller){
 const frame=(event,value)=>controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`));
 frame('chat.stream.started',{version:1,providerId:'a',reasoningKind:'thinking'});frame('chat.content.delta',{delta:'流式前半段'});
 window.finishWritingStream=()=>{frame('chat.content.delta',{delta:'，完整结尾。'});frame('chat.stream.completed',{finishReason:'stop'});controller.close();};
 options.signal.addEventListener('abort',()=>controller.error(new DOMException('Aborted','AbortError')),{once:true});
 }}),{headers:{'Content-Type':'text/event-stream'}});};
 });
}
test('实时写入期间锁定版本和删除，切换会话继续写回原章',async({page})=>{
 await load(page,'light',true);await send(page,'/create Chapter6');await liveStream(page);await send(page,'/write 写一章');
 await expect(page.getByTestId('writing-body')).toHaveText('流式前半段');await expect(page.getByRole('button',{name:'删除章节',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'上一版本',exact:true})).toBeDisabled();
 await page.locator('[data-conversation-id="other"]').first().click();await page.evaluate(()=>window.finishWritingStream());
 await page.locator('[data-conversation-id="c"]').first().click();await expect(page.getByTestId('writing-body')).toHaveText('流式前半段，完整结尾。');await expect(page.locator('#messageList')).not.toContainText('流式前半段');
});
test('停止实时流保留已写正文，后续模式不重置',async({page})=>{
 await load(page,'light',true);await send(page,'/create Chapter6');await liveStream(page);await send(page,'/write 写一章');
 await expect(page.getByTestId('writing-body')).toHaveText('流式前半段');await page.locator('#sendBtn').click();
 await expect(page.locator('.writing-document')).toContainText('未完整结束');await expect(page.getByTestId('writing-body')).toHaveText('流式前半段');await expect(page.locator('.writing-status')).toContainText('写作');
});
test('达到输出上限时保留正文并标记未完整结束',async({page})=>{
 await load(page,'light',true);await send(page,'/create 一章');
 const frames=[['chat.stream.started',{version:1,providerId:'a',reasoningKind:'thinking'}],['chat.content.delta',{delta:'上限前正文'}],['chat.stream.completed',{finishReason:'length'}]];
 await page.route('**/api/chat',r=>r.fulfill({contentType:'text/event-stream',body:frames.map(([event,value])=>`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`).join('')}));
 await send(page,'/write 继续');await expect(page.getByTestId('writing-body')).toHaveText('上限前正文');await expect(page.locator('.writing-document')).toContainText('未完整结束');
});

test('仅指令创建和重命名，保留模式正文与版本且不发送模型请求', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/chat', r => { requests++; return r.fulfill({ json: reply('不应发送') }); });
  await load(page); await send(page, '/create "雨夜 重逢"'); await manual(page, '保留正文');
  await send(page, '/write');
  await expect(page.getByLabel('新章节名称', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('当前章节名称', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '重命名', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '收起写入工作区', exact: true })).toHaveCount(0);
  const before = (await stored(page)).writing;
  await send(page, '/NAME "雨夜 重逢" "黎明 之后"');
  await expect(page.locator('.writing-document h3')).toHaveText('黎明 之后');
  await expect(page.locator('.writing-status')).toContainText('写作');
  await expect(page.getByTestId('writing-body')).toHaveText('保留正文');
  const after = (await stored(page)).writing;
  expect(after.chapters[0].id).toBe(before.chapters[0].id);
  expect(after.chapters[0].versions).toEqual(before.chapters[0].versions);
  await send(page, '/name 不存在 新名字');
  await expect(page.locator('#composerInput')).toHaveValue('/name 不存在 新名字');
  expect(requests).toBe(0);
  await page.reload();
  await expect(page.locator('.writing-document h3')).toHaveText('黎明 之后');
});

test('右侧栏反向动画、减少动态效果及未保存编辑保留', async ({ page }) => {
  await load(page); await send(page, '/create 一章');
  const toggle = page.getByRole('button', { name: '右边栏', exact: true });
  await page.getByRole('button', { name: '手动编辑', exact: true }).click();
  await page.getByLabel('编辑正文', { exact: true }).fill('尚未保存的编辑');
  await toggle.click(); await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByLabel('编辑正文', { exact: true })).toHaveValue('尚未保存的编辑');
  await toggle.click();
  await expect(page.locator('.writing-pane')).toHaveAttribute('inert', '');
  await expect(page.locator('.writing-pane')).toBeHidden();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await toggle.click();
  expect(await page.locator('.writing-pane').evaluate(el => getComputedStyle(el).transform)).toBe('none');
  await page.getByRole('button', { name: '保存正文', exact: true }).click();
  await expect(page.getByTestId('writing-body')).toHaveText('尚未保存的编辑');
});
