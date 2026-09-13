import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const dir=new URL('./',import.meta.url).pathname;
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
try {
for(const scheme of ['light','dark']) for(const width of [1280,1024,390]) {
 const page=await browser.newPage({viewport:{width,height:840},reducedMotion:'reduce'});
 await page.addInitScript(s=>localStorage.setItem('tribblebook-ui-preferences-v1',JSON.stringify({themeId:'everforest',appearanceMode:s})),scheme);
 await page.route('**/api/health',r=>r.fulfill({json:{ok:true}}));
 await page.route('**/api/providers',r=>r.fulfill({json:{providers:[]}}));
 await page.goto('http://127.0.0.1:5207/#/chat');
 await page.locator('#composerInput').waitFor({state:'visible'});
 if(width<=1040) await page.locator(width>720?'#railExpandBtn':'#drawerToggleBtn').click();
 await page.locator('#archiveDrawer').waitFor({state:'visible'});
 const chat=await page.locator('#archiveDrawer').evaluate(e=>e.getBoundingClientRect().width);
 const chatOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
 await page.screenshot({path:`${dir}/chat-${scheme}-${width}.png`});
 await page.evaluate(()=>location.hash='#/settings/providers');
 await page.locator('.settings-index').waitFor({state:'visible'});
 const settings=await page.locator('.settings-index').evaluate(e=>e.getBoundingClientRect().width);
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
 await page.screenshot({path:`${dir}/settings-${scheme}-${width}.png`});
 const result={scheme,width,chat,settings,chatOverflow,overflow}; results.push(result);
 if(chat!==(width>720?304:width) || settings!==(width>720?304:width) || overflow || chatOverflow) throw Error(JSON.stringify(result));
 await page.close();
}
} finally {await browser.close();writeFileSync(`${dir}/measurements.json`,JSON.stringify(results,null,2));}
console.log(JSON.stringify(results,null,2));
