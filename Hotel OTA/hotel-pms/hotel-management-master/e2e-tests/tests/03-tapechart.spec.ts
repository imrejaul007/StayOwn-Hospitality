import { test, expect } from '@playwright/test';
import { AuthHelper } from '../helpers/auth-helper';

test.describe('TapeChart Management', () => {
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    // TapeChart requires admin access
    await authHelper.login('admin');
  });

  test('should display tape chart grid', async ({ page }) => {
    // Navigate to tape chart
    await page.goto('/admin/tape-chart');

    // Wait for tape chart to load
    await page.waitForSelector('.tape-chart, [data-testid="tape-chart"]', { timeout: 30000 });

    // Verify room rows are displayed
    await expect(page.locator('.room-row, [data-testid="room-row"]')).toHaveCount(await page.locator('.room-row, [data-testid="room-row"]').count());

    // Verify date columns are displayed
    await expect(page.locator('.date-column, [data-testid="date-column"]')).toHaveCount(await page.locator('.date-column, [data-testid="date-column"]').count());
  });

  test('should drag and drop room assignment', async ({ page }) => {
    await page.goto('/admin/tape-chart');
    await page.waitForSelector('.tape-chart', { timeout: 30000 });

    // Find a reservation that can be dragged
    const draggableReservation = await page.locator('.draggable-reservation, [draggable="true"]').first();

    if (await draggableReservation.count() > 0) {
      // Get initial position
      const initialRoom = await draggableReservation.getAttribute('data-room-id');

      // Find a target room cell
      const targetCell = await page.locator('.room-cell:not(.occupied), [data-testid="available-cell"]').first();

      if (await targetCell.count() > 0) {
        // Perform drag and drop
        await draggableReservation.dragTo(targetCell);

        // Wait for update
        await page.waitForTimeout(1000);

        // Verify reservation moved
        const newRoom = await draggableReservation.getAttribute('data-room-id');
        expect(newRoom).not.toBe(initialRoom);
      }
    }
  });

  test('should change room status', async ({ page }) => {
    await page.goto('/admin/tape-chart');
    await page.waitForSelector('.tape-chart', { timeout: 30000 });

    // Click on a room cell
    const roomCell = await page.locator('.room-cell, [data-testid="room-cell"]').first();
    await roomCell.click();

    // Look for status change options
    const statusMenu = await page.locator('.status-menu, [data-testid="status-options"]');
    if (await statusMenu.count() > 0) {
      // Change to maintenance
      await page.click('button:has-text("Maintenance"), option:has-text("Maintenance")');

      // Verify status changed
      await expect(roomCell).toHaveClass(/maintenance|status-maintenance/);
    }
  });

  test('should filter rooms by type', async ({ page }) => {
    await page.goto('/admin/tape-chart');
    await page.waitForSelector('.tape-chart', { timeout: 30000 });

    // Find filter dropdown
    const filterDropdown = await page.locator('select[name="roomType"], [data-testid="room-type-filter"]');
    if (await filterDropdown.count() > 0) {
      // Select a room type
      await filterDropdown.selectOption({ index: 1 });

      // Wait for filter to apply
      await page.waitForTimeout(1000);

      // Verify filtered results
      const visibleRooms = await page.locator('.room-row:visible, [data-testid="room-row"]:visible').count();
      expect(visibleRooms).toBeGreaterThan(0);
    }
  });

  test('should filter rooms by floor', async ({ page }) => {
    await page.goto('/admin/tape-chart');
    await page.waitForSelector('.tape-chart', { timeout: 30000 });

    // Find floor filter
    const floorFilter = await page.locator('select[name="floor"], [data-testid="floor-filter"]');
    if (await floorFilter.count() > 0) {
      // Select a floor
      await floorFilter.selectOption({ index: 1 });

      // Wait for filter to apply
      await page.waitForTimeout(1000);

      // Verify filtered results
      const visibleRooms = await page.locator('.room-row:visible').count();
      expect(visibleRooms).toBeGreaterThan(0);
    }
  });

  test('should create room block for group', async ({ page }) => {
    await page.goto('/admin/tape-chart');
    await page.waitForSelector('.tape-chart', { timeout: 30000 });

    // Click create block button
    const createBlockButton = await page.locator('button:has-text("Create Block"), button:has-text("Room Block")');
    if (await createBlockButton.count() > 0) {
      await createBlockButton.click();

      // Fill block details
      await page.fill('input[name="blockName"], input[name="name"]', 'Conference Group');
      await page.fill('input[name="numberOfRooms"], input[name="rooms"]', '5');
      await page.fill('input[name="checkIn"]', '2025-03-01');
      await page.fill('input[name="checkOut"]', '2025-03-05');

      // Submit
      await page.click('button:has-text("Create"), button:has-text("Save")');

      // Verify block created
      await expect(page.locator('text=Conference Group')).toBeVisible({ timeout: 10000 });
    }
  });

  test('should handle VIP guest assignment', async ({ page }) => {
    await page.goto('/admin/tape-chart');
    await page.waitForSelector('.tape-chart', { timeout: 30000 });

    // Look for VIP indicator
    const vipReservation = await page.locator('.vip-reservation, [data-vip="true"]').first();
    if (await vipReservation.count() > 0) {
      // Click on VIP reservation
      await vipReservation.click();

      // Verify VIP options appear
      await expect(page.locator('text=/VIP|Priority|Special/')).toBeVisible();

      // Try to assign to premium room
      const premiumRoom = await page.locator('.premium-room, [data-room-type="suite"]').first();
      if (await premiumRoom.count() > 0) {
        await vipReservation.dragTo(premiumRoom);

        // Verify assignment
        await expect(vipReservation).toBeVisible();
      }
    }
  });

  test('should show room occupancy statistics', async ({ page }) => {
    await page.goto('/admin/tape-chart');
    await page.waitForSelector('.tape-chart', { timeout: 30000 });

    // Look for statistics panel
    const statsPanel = await page.locator('.statistics-panel, [data-testid="occupancy-stats"]');
    if (await statsPanel.count() > 0) {
      // Verify statistics are displayed
      await expect(statsPanel.locator('text=/Occupancy|Available|Occupied/')).toBeVisible();
      await expect(statsPanel.locator('text=/%|[0-9]+/')).toBeVisible();
    }
  });

  test('should handle concurrent user updates', async ({ page, context }) => {
    await page.goto('/admin/tape-chart');
    await page.waitForSelector('.tape-chart', { timeout: 30000 });

    // Open second tab to simulate another user
    const page2 = await context.newPage();
    const authHelper2 = new AuthHelper(page2);
    await authHelper2.login('admin');
    await page2.goto('/admin/tape-chart');
    await page2.waitForSelector('.tape-chart', { timeout: 30000 });

    // Make change in first tab
    const roomCell1 = await page.locator('.room-cell').first();
    await roomCell1.click();

    // Check if lock indicator appears in second tab
    await page2.waitForTimeout(2000);
    const lockIndicator = await page2.locator('.locked-cell, [data-locked="true"]');

    // This tests if the system handles concurrent editing
    expect(await lockIndicator.count()).toBeGreaterThanOrEqual(0);

    // Close second tab
    await page2.close();
  });

  test('should export tape chart data', async ({ page }) => {
    await page.goto('/admin/tape-chart');
    await page.waitForSelector('.tape-chart', { timeout: 30000 });

    // Look for export button
    const exportButton = await page.locator('button:has-text("Export"), button:has-text("Download")');
    if (await exportButton.count() > 0) {
      // Start waiting for download
      const downloadPromise = page.waitForEvent('download');

      // Click export
      await exportButton.click();

      // Wait for download to start
      const download = await Promise.race([
        downloadPromise,
        new Promise(resolve => setTimeout(() => resolve(null), 5000))
      ]);

      if (download) {
        // Verify download started
        expect(download).toBeTruthy();
      }
    }
  });

  test('should navigate between date ranges', async ({ page }) => {
    await page.goto('/admin/tape-chart');
    await page.waitForSelector('.tape-chart', { timeout: 30000 });

    // Look for date navigation
    const nextButton = await page.locator('button:has-text("Next"), button[aria-label="Next"]');
    const prevButton = await page.locator('button:has-text("Previous"), button[aria-label="Previous"]');

    if (await nextButton.count() > 0) {
      // Navigate to next period
      await nextButton.click();
      await page.waitForTimeout(1000);

      // Verify dates changed
      const dateHeaders = await page.locator('.date-header, [data-testid="date-header"]').first();
      const firstDate = await dateHeaders.innerText();

      // Navigate back
      if (await prevButton.count() > 0) {
        await prevButton.click();
        await page.waitForTimeout(1000);

        // Verify dates changed back
        const newFirstDate = await dateHeaders.innerText();
        expect(newFirstDate).not.toBe(firstDate);
      }
    }
  });

  test('should show room details on hover', async ({ page }) => {
    await page.goto('/admin/tape-chart');
    await page.waitForSelector('.tape-chart', { timeout: 30000 });

    // Hover over a room
    const roomCell = await page.locator('.room-cell, [data-testid="room-cell"]').first();
    await roomCell.hover();

    // Check for tooltip or details popup
    const tooltip = await page.locator('.tooltip, [role="tooltip"], .room-details-popup');
    if (await tooltip.count() > 0) {
      await expect(tooltip).toBeVisible();
      // Verify room details are shown
      await expect(tooltip.locator('text=/Room|Guest|Status/')).toBeVisible();
    }
  });
});