import { chromium, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const out='reports/search-focus-2026-09-13';const browser=await chromium.launch({channel:'chrome'});const results=[];
try{for(const scheme of ['light','dark'])for(const width of [1280,1024,390]){
const page=await browser.newPage({viewport:{width,height:900}});page.setDefaultTimeout(6000);
await page.addInitScript(s=>localStorage.setItem('tribblebook-ui-preferences-v1',JSON.stringify({appearanceMode:s})),scheme);
await page.route('**/api/**',r=>r.fulfill({json:r.request().url().includes('/providers')?{providers:[]}:{ok:true}}));
await page.goto('http://127.0.0.1:5198/#/chat');await page.waitForTimeout(500);
const input=page.locator('#searchInput');if(!await input.isVisible())await page.locator('#railSearchBtn:visible, #drawerToggleBtn:visible').first().click();await input.click();await input.fill('搜索测试');await expect(input).toBeFocused();await expect(input).toHaveCSS('outline-style','none');await expect(input).toHaveCSS('box-shadow','none');
await page.screenshot({path:`${out}/chat-${scheme}-${width}.png`});
await page.goto('http://127.0.0.1:5198/#/settings/context');const settings=page.getByRole('searchbox',{name:'搜索设置'});await settings.fill('上下文');await expect(settings).toBeFocused();await expect(settings).toHaveCSS('outline-style','none');await expect(settings).toHaveCSS('box-shadow','none');const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow)throw Error('overflow');
await page.screenshot({path:`${out}/settings-${scheme}-${width}.png`});results.push({scheme,width,focus:true,extraOutline:false,extraShadow:false,overflow});await page.close();
}writeFileSync(`${out}/verification.json`,JSON.stringify(results,null,2));console.log('6 theme/width combinations passed for both search fields.');}finally{await browser.close();}
