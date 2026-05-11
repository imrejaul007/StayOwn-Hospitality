import { test, expect } from '@playwright/test';
import { AuthHelper } from '../helpers/auth-helper';
import { testUsers } from '../fixtures/test-users';

test.describe('Authentication Flow', () => {
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
  });

  test('should register a new guest user', async ({ page }) => {
    const newUser = await authHelper.register();

    // Verify registration success
    expect(await authHelper.isLoggedIn()).toBeTruthy();

    // Verify redirect to dashboard
    await expect(page).toHaveURL(/\/guest\/dashboard/);

    // Verify user name is displayed
    const userName = await authHelper.getCurrentUser();
    expect(userName).toBeTruthy();
  });

  test('should login as guest user', async ({ page }) => {
    await authHelper.login('guest');

    // Verify login success
    expect(await authHelper.isLoggedIn()).toBeTruthy();

    // Verify redirect to guest dashboard
    await expect(page).toHaveURL(/\/guest\/dashboard/);

    // Verify dashboard elements are visible
    await expect(page.locator('text=My Bookings, text=Bookings')).toBeVisible();
  });

  test('should login as admin user', async ({ page }) => {
    await authHelper.login('admin');

    // Verify login success
    expect(await authHelper.isLoggedIn()).toBeTruthy();

    // Verify redirect to admin dashboard
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    // Verify admin-specific elements
    await expect(page.locator('text=Admin Dashboard, text=Dashboard Overview')).toBeVisible();
    await expect(page.locator('text=Rooms, text=Room Management')).toBeVisible();
  });

  test('should login as staff user', async ({ page }) => {
    await authHelper.login('staff');

    // Verify login success
    expect(await authHelper.isLoggedIn()).toBeTruthy();

    // Verify redirect to staff dashboard
    await expect(page).toHaveURL(/\/staff\/dashboard/);

    // Verify staff-specific elements
    await expect(page.locator('text=Staff Dashboard, text=My Tasks')).toBeVisible();
  });

  test('should fail login with invalid credentials', async ({ page }) => {
    await page.goto('/login');

    // Try to login with invalid credentials
    await page.fill('input[name="email"], input[type="email"]', 'invalid@email.com');
    await page.fill('input[name="password"], input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]:has-text("Login"), button[type="submit"]:has-text("Sign In")');

    // Verify error message
    await expect(page.locator('text=/Invalid|Incorrect|Wrong|Failed/')).toBeVisible({ timeout: 10000 });

    // Verify still on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should logout successfully', async ({ page }) => {
    // First login
    await authHelper.login('guest');
    expect(await authHelper.isLoggedIn()).toBeTruthy();

    // Then logout
    await authHelper.logout();

    // Verify logout success
    expect(await authHelper.isLoggedIn()).toBeFalsy();

    // Verify redirect to homepage or login
    await expect(page).toHaveURL(/\/(login|$)/);
  });

  test('should redirect to login when accessing protected route', async ({ page }) => {
    // Try to access protected route without login
    await page.goto('/guest/dashboard');

    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/);

    // Verify login form is visible
    await expect(page.locator('input[name="email"], input[type="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"], input[type="password"]')).toBeVisible();
  });

  test('should persist session across page refresh', async ({ page }) => {
    // Login
    await authHelper.login('guest');
    expect(await authHelper.isLoggedIn()).toBeTruthy();

    // Refresh page
    await page.reload();

    // Should still be logged in
    expect(await authHelper.isLoggedIn()).toBeTruthy();
    await expect(page).toHaveURL(/\/guest\/dashboard/);
  });

  test('should handle password reset flow', async ({ page }) => {
    await page.goto('/login');

    // Click forgot password link
    await page.click('text=Forgot Password, text=Reset Password, a[href*="forgot"], a[href*="reset"]');

    // Fill email for password reset
    await page.fill('input[name="email"], input[type="email"]', testUsers.guest.email);

    // Submit reset request
    await page.click('button:has-text("Reset"), button:has-text("Send")');

    // Verify success message
    await expect(page.locator('text=/Email sent|Check your email|Reset link sent/')).toBeVisible({ timeout: 10000 });
  });

  test('should validate email format during registration', async ({ page }) => {
    await page.goto('/register');

    // Fill invalid email
    await page.fill('input[name="email"]', 'invalidemail');
    await page.fill('input[name="password"]', 'Test@123456');
    await page.fill('input[name="name"]', 'Test User');

    // Try to submit
    await page.click('button[type="submit"]:has-text("Register"), button[type="submit"]:has-text("Sign Up")');

    // Verify validation error
    await expect(page.locator('text=/Invalid email|Valid email|Email format/')).toBeVisible();
  });

  test('should enforce password requirements', async ({ page }) => {
    await page.goto('/register');

    // Fill weak password
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', '123'); // Too weak
    await page.fill('input[name="name"]', 'Test User');

    // Try to submit
    await page.click('button[type="submit"]:has-text("Register"), button[type="submit"]:has-text("Sign Up")');

    // Verify validation error
    await expect(page.locator('text=/Password must|Strong password|minimum/')).toBeVisible();
  });
});