import { chromium, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
const theme=JSON.parse(readFileSync('src/resources/themes/tako-festival-theme-v1.json','utf8')).theme;
const browser=await chromium.launch({channel:'chrome'});const results=[];
try{for(const scheme of ['light','dark'])for(const width of [1280,1024,390]){
 const page=await browser.newPage({viewport:{width,height:900}});
 await page.route('**/api/**',r=>r.fulfill({json:r.request().url().includes('/providers')?{providers:[]}:{ok:true}}));
 await page.goto('http://127.0.0.1:5173/');
 await page.waitForFunction(()=>window.AiChatboxThemeAPI);
 await page.evaluate(async({theme,scheme})=>{
 const archive=await import('/src/modules/appearance/domain/archive.js');
 const old=structuredClone(theme);old.id='everforest';old.label='Everforest';old.tokens.dark['--pear']='#a7c080';old.tokens.dark['--canvas-start']='#222a2e';
 await archive.createThemeArchiveStore().save({kind:archive.THEME_ARCHIVE_KIND,version:archive.THEME_ARCHIVE_VERSION,removedIds:[],files:[{id:old.id,path:'themes/everforest.theme.json',source:'user',raw:null,definition:old}]});
 localStorage.setItem('tribblebook-ui-preferences-v1',JSON.stringify({themeId:'everforest',appearanceMode:scheme}));
 },{theme,scheme});
 await page.reload();
 await expect(page.locator('html')).toHaveAttribute('data-theme','tako-festival');
 await expect(page.locator('html')).toHaveAttribute('data-scheme',scheme);
 await page.waitForFunction(()=>window.AiChatboxThemeAPI?.list().every(t=>t.id==='tako-festival'));
 const actual=await page.evaluate(()=>({id:document.documentElement.dataset.theme,pear:document.documentElement.style.getPropertyValue('--pear'),art:document.documentElement.style.getPropertyValue('--theme-artwork'),ids:window.AiChatboxThemeAPI.list().map(t=>t.id),overflow:document.documentElement.scrollWidth>innerWidth}));
 expect(actual.pear).toBe(theme.tokens[scheme]['--pear']);expect(actual.ids).toEqual(['tako-festival']);expect(actual.art).toContain('tako-');expect(actual.overflow).toBe(false);
 await page.screenshot({path:`reports/theme-retirement-2026-09-13/${scheme}-${width}.png`});
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','tako-festival');
 results.push({scheme,width,...actual});await page.close();
}writeFileSync('reports/theme-retirement-2026-09-13/verification.json',JSON.stringify(results,null,2));console.log('6 legacy archive migration / reload / palette / artwork combinations passed.');}finally{await browser.close();}
