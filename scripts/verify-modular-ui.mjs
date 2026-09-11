import {chromium} from '@playwright/test';
import fs from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[];const result=[];
try {
 for(const [port,optional] of [[5188,false],[5199,true]]){
  const context=await browser.newContext({viewport:{width:1280,height:840}});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(route.request().url().includes('/health')?{ok:true}:{providers:[]})}));
  await page.goto(`http://127.0.0.1:${port}/`);await page.locator('#composerInput').waitFor();
  await page.waitForFunction(()=>!document.querySelector('#composerInput').disabled);
  await page.screenshot({path:`reports/${optional?'optional':'default'}-desktop.png`,fullPage:true});
  await page.locator('.sidebar-settings').click();
  const categories=await page.locator('[data-section].settings-nav-item').evaluateAll(nodes=>nodes.map(node=>node.dataset.section));
  const expected=optional?['appearance','providers','context']:['appearance','providers','context','tools','skills','data','about'];
  if(JSON.stringify(categories)!==JSON.stringify(expected)) throw Error(`Wrong installed categories: ${categories}`);
  await page.getByRole('searchbox',{name:'搜索设置'}).fill('skill');
  if(optional && await page.locator('.settings-search-results .settings-nav-item').count()) throw Error('Disabled module leaked search entries');
  await page.getByRole('searchbox',{name:'搜索设置'}).fill('');
  await page.locator('[data-section="context"]').click();await page.locator('#cc-systemPrompt').waitFor();
  const panel=page.locator('[data-surface="panel"]').filter({has:page.locator('#cc-systemPrompt')});
  const style=el=>{const s=getComputedStyle(el);return [s.backgroundColor,s.borderColor,s.borderWidth];};
  const before=await panel.evaluate(style);await panel.hover();const after=await panel.evaluate(style);
  if(JSON.stringify(before)!==JSON.stringify(after)) throw Error('Panel changes paint on hover');
  for(const width of [1280,1024,390]){
   await page.setViewportSize({width,height:840});
   await page.evaluate(()=>document.activeElement?.blur());
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
   if(overflow)throw Error(`Page overflow: ${width}`);
   if(!optional)await page.screenshot({path:`reports/settings-${width}.png`,fullPage:true});
  }
  result.push({port,optional,categories,panelHoverStable:true,widths:[1280,1024,390],pageErrors:errors.length});
  await context.close();
 }
 if(errors.length)throw Error(errors.join('\n'));
 fs.writeFileSync('reports/modular-ui.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
} finally {await browser.close();}
