import {test,expect} from '@playwright/test';

async function load(page) {
 await page.route('**/api/**',route=>route.fulfill({json:route.request().url().includes('/health')?{ok:true}:{providers:[]}}));
 await page.goto('/');
 await expect(page.locator('#composerInput')).toBeEnabled();
}

test('注册的七个设置页面均可访问且共用字段模板',async({page})=>{
 await load(page);await page.locator('.sidebar-settings').click();
 for(const section of ['appearance','providers','context','tools','skills','data','about']){
  await page.locator(`.settings-nav-item[data-section="${section}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/settings/${section}$`));
  await expect(page.locator('#settingsContent .settings-pane')).toBeVisible();
 }
 await page.locator('[data-section="context"]').click();
 await expect(page.locator('#cc-systemPrompt')).toHaveClass(/ui-input/);
 const panel=page.locator('[data-surface="panel"]').filter({has:page.locator('#cc-systemPrompt')});
 const paint=el=>{const s=getComputedStyle(el);return [s.backgroundColor,s.borderColor];};
 const before=await panel.evaluate(paint);await panel.hover();expect(await panel.evaluate(paint)).toEqual(before);
});

test('共享历史表面与项目状态操作：创建、重命名、删除保留聊天',async({page})=>{
 await load(page);await page.locator('[data-project-action="create"]').click();
 await page.locator('.dialog-input').fill('模块边界验证');await page.getByRole('button',{name:'保存',exact:true}).click();
 const row=page.locator('.sidebar-project').filter({has:page.locator('.project-name',{hasText:'模块边界验证'})});
 await expect(row).toBeVisible();await row.locator('.project-row').hover();await row.locator('[data-project-action="menu"]').click();
 await page.getByRole('menuitem',{name:'重命名项目'}).click();await page.locator('.dialog-input').fill('模块边界验证新版');await page.getByRole('button',{name:'保存',exact:true}).click();
 const renamed=page.locator('.sidebar-project').filter({has:page.locator('.project-name',{hasText:'模块边界验证新版'})});
 await expect(renamed).toBeVisible();await page.locator('#composerInput').fill('保留草稿');
 const id=await page.locator('.conversation-item.is-selected').getAttribute('data-conversation-id');
 await renamed.locator('.project-row').hover();await renamed.locator('[data-project-action="menu"]').click();await page.getByRole('menuitem',{name:'删除项目'}).click();
 await page.locator('.dialog-card [data-role="confirm"]').click();await expect(renamed).toHaveCount(0);
 await expect(page.locator(`[data-conversation-id="${id}"]`)).toBeVisible();await expect(page.locator('#composerInput')).toHaveValue('保留草稿');
 await expect(page.locator(`[data-conversation-id="${id}"]`)).toHaveAttribute('data-surface','interactive');
});
