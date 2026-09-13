import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

for (const scheme of ['light', 'dark']) {
  for (const width of [1280, 1024, 390]) {
    test(`章鱼烧主题消息、焦点与刷新 ${scheme} ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await page.addInitScript((mode) => {
        if (localStorage.getItem('tako-visual-seeded')) return;
        localStorage.setItem('tako-visual-seeded', '1');
        localStorage.setItem('tribblebook-ui-preferences-v1', JSON.stringify({ themeId: 'everforest', appearanceMode: mode }));
        localStorage.setItem('tribblebook-v6-state', JSON.stringify({
          version: '2.5.1', activeConversationId: 'tako-preview', activeProviderId: '', providers: [],
          conversations: [{ id: 'tako-preview', title: '今晚，来一份章鱼烧', createdAt: 1789272000000, updatedAt: 1789272000000,
            model: '', providerId: '', draft: '', messages: [
              { id: 'question', role: 'user', content: '做一份外酥里嫩的章鱼烧，需要注意什么？', createdAt: 1789272000000 },
              { id: 'answer', role: 'assistant', content: '## 趁热，刚刚好\n\n先把模具预热，再薄薄刷一层油。面糊倒满，加入章鱼粒与葱花，等边缘凝固后轻轻翻面。\n\n- **外皮金黄**：分次翻转，受热均匀。\n- **内里柔软**：留一点流动的面糊，避免烤得太干。\n- **最后点睛**：酱汁、蛋黄酱、海苔与木鱼花。\n\n```js\nconst takoyaki = {\n  crust: "金黄酥脆",\n  topping: ["酱汁", "海苔"]\n};\n```', createdAt: 1789272002000 }
            ] }]
        }));
      }, scheme);
      await page.route('**/api/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"theme fixture offline"}' }));
      await page.goto('/');
      await expect(page.locator('.message-entry')).toHaveCount(2);
      await expect(page.locator('html')).toHaveAttribute('data-scheme', scheme);
      await expect(page.locator('.code-block')).toBeVisible();
      const artwork = await page.locator('.app-canvas').evaluate(el => {
        const style = getComputedStyle(el, '::before');
        return { image: style.backgroundImage, pointerEvents: style.pointerEvents };
      });
      expect(artwork.image).toContain(scheme === 'light' ? 'tako-daylight' : 'tako-nightfall');
      expect(artwork.pointerEvents).toBe('none');
      await page.locator('#composerInput').fill('再加一点海苔。');
      await page.locator('#composerInput').focus();
      await expect(page.locator('#composerInput')).toBeFocused();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      mkdirSync('reports/tako-artwork-2026-09-13', { recursive: true });
      await page.screenshot({ path: `reports/tako-artwork-2026-09-13/messages-${scheme}-${width}.png`, fullPage: true });
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-scheme', scheme);
      await expect(page.locator('#composerInput')).toHaveValue('再加一点海苔。');
      await expect(page.locator('.message-entry')).toHaveCount(2);
    });
  }
}
