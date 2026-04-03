import { test, expect } from '@playwright/test';

test.describe('Angular shell (static build)', () => {
  test('loads root and renders app root', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('app-root')).toBeVisible();
  });
});
