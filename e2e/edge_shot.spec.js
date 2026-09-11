import { test, expect } from '@playwright/test';

// pop-in 入场带 scale(0.985)→1，等动画结束再测量，避免量到中间帧
async function settlePopover(page) {
  await page.locator('.runtime-popover').evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
}

async function openPanel(page) {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.click('#runtimeBtn');
  await expect(page.locator('.runtime-popover')).toBeVisible();
  await settlePopover(page);
}

test('runtime panel fixed across model-name lengths', async ({ page }) => {
  await openPanel(page);
  await page.evaluate(() => {
    const m = document.querySelector('#modelValue');
    if (m) m.textContent = 'deepseek-v4-flash';
  });
  const s = await page.locator('.runtime-popover').boundingBox();
  const anchorShort = await page.locator('#runtimeBtn').boundingBox();
  await page.screenshot({ path: '/tmp/edge-short.png' });

  await page.keyboard.press('Escape');
  await page.click('#runtimeBtn');
  await settlePopover(page);
  await page.evaluate(() => {
    const m = document.querySelector('#modelValue');
    if (m) m.textContent = 'deepseek-v4-flash-vision-exp-longer';
  });
  const l = await page.locator('.runtime-popover').boundingBox();
  const anchorLong = await page.locator('#runtimeBtn').boundingBox();
  await page.screenshot({ path: '/tmp/edge-long.png' });

  console.log(
    'SHORT left=', s.x, ' LONG left=', l.x,
    ' SHORT right=', s.x + s.width, ' LONG right=', l.x + l.width,
    ' width=', s.width
  );
  // 锚点右缘是稳定参照：面板右缘恒定且与锚点右缘对齐（视口富余时不触发钳制）
  expect(Math.abs(s.x - l.x)).toBeLessThan(2);
  expect(Math.abs((s.x + s.width) - (l.x + l.width))).toBeLessThan(2);
  expect(Math.abs((s.x + s.width) - (anchorShort.x + anchorShort.width))).toBeLessThan(1.5);
  expect(Math.abs((l.x + l.width) - (anchorLong.x + anchorLong.width))).toBeLessThan(1.5);
});

test('runtime rows keep aligned values and truncate long model ids', async ({ page }) => {
  await openPanel(page);
  // 模拟极长模型名（面板值直接改文本，等价于会话选择了长名模型）
  await page.evaluate(() => {
    const value = document.querySelector('[data-runtime-model-value]');
    if (value) value.textContent = 'deepseek-v4-flash-vision-exp-2026-08-27-nightly-superlong';
  });
  const card = await page.locator('.runtime-popover').boundingBox();
  const { gap, tailGap, truncated, valueRight, chevronLeft, chevronRight, rowRight, effortChevronLeft } = await page.evaluate(() => {
    const row = document.querySelector('[data-runtime-open="model"]');
    const title = row.querySelector('.option-title').getBoundingClientRect();
    const value = row.querySelector('[data-runtime-model-value]');
    const valueRect = value.getBoundingClientRect();
    const chevron = row.querySelector('.runtime-row-chevron').getBoundingClientRect();
    const effortChevron = document.querySelector('[data-runtime-open="effort"] .runtime-row-chevron').getBoundingClientRect();
    return {
      gap: valueRect.left - title.right,
      tailGap: chevron.left - valueRect.right,
      truncated: value.scrollWidth > value.clientWidth,
      valueRight: valueRect.right,
      chevronLeft: chevron.left,
      chevronRight: chevron.right,
      rowRight: row.getBoundingClientRect().right,
      effortChevronLeft: effortChevron.left
    };
  });
  console.log('label→value gap=', gap, ' value→chevron gap=', tailGap, ' truncated=', truncated);
  // 两行箭头同列：思考强度行值+箭头贴行尾后，箭头 x 与模型行一致
  expect(Math.abs(effortChevronLeft - chevronLeft)).toBeLessThan(1);
  // 值列使用剩余空间，箭头列紧跟其后。
  expect(gap).toBeGreaterThanOrEqual(4);
  expect(gap).toBeLessThan(55);
  expect(tailGap).toBeGreaterThan(2);
  expect(tailGap).toBeLessThan(7);
  expect(truncated).toBe(true);
  expect(valueRight).toBeLessThanOrEqual(chevronLeft + 1);
  // 行不得被长名撑破卡片：行与箭头都收在卡片内（grid item min-width:auto 回归哨兵）
  expect(card.width).toBeCloseTo(320, 0);
  expect(rowRight).toBeLessThanOrEqual(card.x + card.width + 1);
  expect(chevronRight).toBeLessThanOrEqual(card.x + card.width + 1);
  await page.screenshot({ path: '/tmp/edge-truncated.png' });
});
