import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const phase=process.argv[2] || 'after';
const dir=new URL(`./${phase}/`,import.meta.url).pathname;mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome'});
const rows=[];
const seed={settingsSchemaVersion:1,projects:[{id:'p',name:'研究项目'}],providers:[{id:'demo',displayName:'示例供应商',responseFormat:'openai-compatible',baseUrl:'https://example.com/v1',models:['demo-model'],defaultModel:'demo-model',hasKeyConfigured:true,contextWindow:131072,maxTokens:8192}],activeProviderId:'demo',activeConversationId:'c',conversations:[{id:'c',projectId:'p',providerId:'demo',model:'demo-model',messages:[]}],projectKnowledge:{p:[]}};
try {
for(const scheme of ['light','dark']) for(const width of (phase==='before'?[1280]:[1280,1024,390])) {
const context=await browser.newContext({viewport:{width,height:900},colorScheme:scheme,reducedMotion:'reduce'});
await context.addInitScript(({seed,scheme})=>{localStorage.setItem('tribblebook-v6-state',JSON.stringify(seed));localStorage.setItem('tribblebook-ui-preferences-v1',JSON.stringify({themeId:'everforest',appearanceMode:scheme}));},{seed,scheme});
await context.route('**/api/health',r=>r.fulfill({json:{ok:true}}));await context.route('**/api/providers',r=>r.fulfill({json:{providers:[]}}));await context.route('**/api/providers/key*',r=>r.fulfill({json:{hasKeyConfigured:true}}));
for(const surface of ['chat','project','appearance','providers','context','tools','tool-editor','skills','data','about','onboarding',...(phase==='after'?['provider-detail','provider-create','model-edit']:[])]) {
 const page=await context.newPage();
 const route=surface==='project'?'chat':surface==='tool-editor'?'settings/tools': ['provider-detail','model-edit'].includes(surface)?'settings/providers/demo':surface==='provider-create'?'settings/providers': ['chat','onboarding'].includes(surface)?surface:`settings/${surface}`;
 await page.goto(`http://127.0.0.1:5211/${surface==='onboarding'?'onboarding.html':`#/${route}`}`);
 if(surface==='onboarding') await page.locator('#onboardingTitle').waitFor();
 else if(['chat','project'].includes(surface)) await page.locator('#composerInput').waitFor();
 else await page.locator('.settings-pane').first().waitFor();
 if(surface!=='onboarding') await expect(page.locator('#stageActions')).toContainText('本地服务正常');
 if(['chat','project'].includes(surface)) await expect(page.locator('.empty-title')).toHaveText('今天想聊点什么？');
 if(surface==='project') {
  if(width<=1040) await page.locator(width>720?'#railExpandBtn':'#drawerToggleBtn').click();
  await page.locator('[data-project-id="p"] .project-row').hover();
  await page.locator('[data-project-id="p"] [data-project-action="menu"]').click();
  await page.getByRole('dialog',{name:'项目设置',exact:true}).waitFor();
 }
 if(surface==='provider-create') {await page.locator('#newProviderBtn').click();await page.getByRole('dialog',{name:'添加供应商',exact:true}).waitFor();}
 if(surface==='model-edit') {await page.locator('.provider-model-main').first().click();await page.locator('#model-id').waitFor();}
 if(surface==='tool-editor') {await page.locator('[data-extension-new="tool"]').click();await page.locator('#ext-name').waitFor();}
 await page.evaluate(()=>document.fonts.ready);
 const measured=await page.evaluate(()=>({text:document.body.innerText,overflow:document.documentElement.scrollWidth>innerWidth}));
 if(measured.overflow) throw Error(`Overflow: ${surface} ${scheme} ${width}`);
 rows.push({surface,scheme,width,characters:measured.text.replace(/\s/g,'').length,overflow:false});
 writeFileSync(`${dir}${surface}-${scheme}-${width}.txt`,measured.text);
 await page.screenshot({path:`${dir}${surface}-${scheme}-${width}.png`,animations:'disabled'});
 await page.close();
}
await context.close();
}
} finally {await browser.close();writeFileSync(`${dir}metrics.json`,JSON.stringify(rows,null,2));}
console.log(`${rows.length} surfaces checked`);
