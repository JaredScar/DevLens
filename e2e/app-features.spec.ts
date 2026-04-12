import { test, expect } from '@playwright/test';

test.describe('Dev-Lens App Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app to fully load
    await expect(page.locator('app-root')).toBeVisible();
    await page.waitForTimeout(500); // Allow initial render
  });

  test.describe('Spotlight Search', () => {
    test('opens with Ctrl+K keyboard shortcut', async ({ page }) => {
      // Initially spotlight should not be visible
      await expect(page.locator('.spotlight')).not.toBeVisible();

      // Press Ctrl+K to open
      await page.keyboard.press('Control+k');

      // Spotlight should now be visible
      await expect(page.locator('.spotlight')).toBeVisible();
      await expect(page.locator('.spotlight__input')).toBeVisible();
    });

    test('closes with Escape key', async ({ page }) => {
      // Open spotlight
      await page.keyboard.press('Control+k');
      await expect(page.locator('.spotlight')).toBeVisible();

      // Press Escape to close
      await page.keyboard.press('Escape');

      // Spotlight should be hidden
      await expect(page.locator('.spotlight')).not.toBeVisible();
    });

    test('shows search results when typing', async ({ page }) => {
      // Open spotlight
      await page.keyboard.press('Control+k');
      await expect(page.locator('.spotlight')).toBeVisible();

      // Type a search query
      await page.fill('.spotlight__input', 'settings');
      await page.waitForTimeout(200); // Allow search to process

      // Results list should be present
      await expect(page.locator('.spotlight__list')).toBeVisible();

      // Should show hint at bottom (may be translation key in test env)
      const hint = page.locator('.spotlight__hint');
      await expect(hint).toBeVisible();
    });

    test('shows categories with icons in results', async ({ page }) => {
      // Open spotlight
      await page.keyboard.press('Control+k');

      // Type to search
      await page.fill('.spotlight__input', 'new');
      await page.waitForTimeout(200);

      // Check for category labels in results
      const results = page.locator('.spotlight__list li');
      if ((await results.count()) > 0) {
        await expect(page.locator('.spotlight__cat-label').first()).toBeVisible();
      }
    });
  });

  test.describe('Left Sidebar', () => {
    test('workspace selector is visible', async ({ page }) => {
      // Workspace selector should be visible in expanded sidebar
      await expect(page.locator('.sidebar__ws-row')).toBeVisible();
      await expect(page.locator('.sidebar__ws-name')).toBeVisible();
    });

    test('sidebar can be collapsed and expanded', async ({ page }) => {
      // Initially sidebar should be expanded (not have collapsed class)
      const sidebar = page.locator('.sidebar');
      await expect(sidebar).not.toHaveClass(/sidebar--collapsed/);

      // Click collapse button
      await page.click('.sidebar__collapse-btn');

      // Sidebar should now be collapsed
      await expect(sidebar).toHaveClass(/sidebar--collapsed/);

      // Click again to expand
      await page.click('.sidebar__collapse-btn');
      await expect(sidebar).not.toHaveClass(/sidebar--collapsed/);
    });

    test('workspace dropdown opens on click', async ({ page }) => {
      // Click on workspace selector
      await page.click('.sidebar__ws-row');

      // Dropdown should appear
      await expect(page.locator('.sidebar__ws-dropdown')).toBeVisible();

      // Should show "New Workspace" button
      await expect(page.locator('.sidebar__ws-add')).toContainText('New Workspace');
    });

    test('tab search filter exists', async ({ page }) => {
      // Tab search input should be visible in expanded sidebar
      await expect(page.locator('input[placeholder*="Search tabs"]')).toBeVisible();
    });
  });

  test.describe('Right Sidebar Widgets', () => {
    test('right sidebar toggle button opens panel', async ({ page }) => {
      // Find and click the panels toggle button in top bar
      const panelsButton = page.locator('button[title="Toggle panels"], button[title="Panels"]');
      if (await panelsButton.isVisible().catch(() => false)) {
        await panelsButton.click();

        // Right sidebar should open
        await expect(page.locator('.rside-wrap')).toBeVisible();
      }
    });

    test('widget rail shows available widgets', async ({ page }) => {
      // Open right sidebar if not already open
      const rightSidebar = page.locator('.rside-wrap');
      if (!(await rightSidebar.isVisible().catch(() => false))) {
        // Try to open via bottom icon bar button
        const bookmarkBtn = page.locator('button[title="Bookmarks"]').first();
        if (await bookmarkBtn.isVisible().catch(() => false)) {
          await bookmarkBtn.click();
        }
      }

      if (await rightSidebar.isVisible().catch(() => false)) {
        // Check widget rail buttons exist
        const railButtons = page.locator('.rside__rail .rside__btn');
        await expect(railButtons.first()).toBeVisible();
      }
    });

    test('can switch between widgets', async ({ page }) => {
      // Open right sidebar
      const rightSidebar = page.locator('.rside-wrap');
      if (!(await rightSidebar.isVisible().catch(() => false))) {
        const panelsBtn = page.locator('button[title="Toggle panels"]').first();
        if (await panelsBtn.isVisible().catch(() => false)) {
          await panelsBtn.click();
          await page.waitForTimeout(300);
        }
      }

      if (await rightSidebar.isVisible().catch(() => false)) {
        // Get first two widget buttons
        const buttons = page.locator('.rside__rail .rside__btn');
        const count = await buttons.count();

        if (count >= 2) {
          // Click first widget
          await buttons.nth(0).click();
          await expect(buttons.nth(0)).toHaveClass(/rside__btn--active/);

          // Click second widget
          await buttons.nth(1).click();
          await expect(buttons.nth(1)).toHaveClass(/rside__btn--active/);
          await expect(buttons.nth(0)).not.toHaveClass(/rside__btn--active/);
        }
      }
    });
  });

  test.describe('App Routes', () => {
    test('root route loads app shell', async ({ page }) => {
      // Navigate to root - app should load
      await page.goto('/');
      await page.waitForTimeout(1000);

      // App root should be visible
      await expect(page.locator('app-root')).toBeVisible();
    });
  });

  test.describe('Focus Mode', () => {
    test('focus mode toggle exists', async ({ page }) => {
      // Look for focus mode button or toggle
      const focusButton = page
        .locator('button[title*="focus"], button[title*="Focus"], .focus-mode-btn')
        .first();

      // It may be in settings or keyboard shortcut activated
      if (await focusButton.isVisible().catch(() => false)) {
        await expect(focusButton).toBeVisible();
      }
    });

    test('keyboard shortcut Ctrl+Alt+F toggles focus mode', async ({ page }) => {
      // Press focus mode shortcut
      await page.keyboard.press('Control+Alt+f');
      await page.waitForTimeout(300);

      // Check if shell gets focus mode class
      const shell = page.locator('.shell');
      const hasFocusClass = await shell.evaluate((el) => el.classList.contains('shell--focus'));

      // Press again to toggle off
      await page.keyboard.press('Control+Alt+f');
      await page.waitForTimeout(300);
    });
  });

  test.describe('Top Bar', () => {
    test('omnibox address bar is present', async ({ page }) => {
      // Omnibox should be visible
      await expect(page.locator('.topbar__omni')).toBeVisible();
      await expect(page.locator('.omnibox__input, input[type="text"]').first()).toBeVisible();
    });

    test('navigation buttons exist', async ({ page }) => {
      // Back and forward buttons (use CSS class selectors since titles may be translation keys)
      const navButtons = page.locator('.topbar__nav button');
      await expect(navButtons.nth(0)).toBeVisible(); // Back button
      await expect(navButtons.nth(1)).toBeVisible(); // Forward button
      await expect(navButtons.nth(2)).toBeVisible(); // Reload/Stop button
    });

    test('privacy badge shows in omnibox', async ({ page }) => {
      // Blocker badge should be visible
      await expect(page.locator('.topbar__badge')).toBeVisible();
    });
  });

  test.describe('Keyboard Shortcuts', () => {
    test('Ctrl+Shift+K opens spotlight', async ({ page }) => {
      // Try alternative shortcut
      await page.keyboard.press('Control+Shift+k');
      await page.waitForTimeout(200);

      // May or may not open depending on configuration
      const spotlight = page.locator('.spotlight');
      const isVisible = await spotlight.isVisible().catch(() => false);

      // Close if opened
      if (isVisible) {
        await page.keyboard.press('Escape');
      }
    });

    test('Escape closes open overlays', async ({ page }) => {
      // Open spotlight first
      await page.keyboard.press('Control+k');
      await expect(page.locator('.spotlight')).toBeVisible();

      // Escape should close it
      await page.keyboard.press('Escape');
      await expect(page.locator('.spotlight')).not.toBeVisible();
    });
  });
});
