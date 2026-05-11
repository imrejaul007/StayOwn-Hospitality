import { Page } from '@playwright/test';
import { testUsers } from '../fixtures/test-users';

export class AuthHelper {
  constructor(private page: Page) {}

  async login(userType: keyof typeof testUsers) {
    const user = testUsers[userType];

    // Navigate to login page
    await this.page.goto('/login');

    // Fill login form
    await this.page.fill('input[name="email"], input[type="email"]', user.email);
    await this.page.fill('input[name="password"], input[type="password"]', user.password);

    // Submit form
    await this.page.click('button[type="submit"]:has-text("Login"), button[type="submit"]:has-text("Sign In")');

    // Wait for navigation based on role
    if (user.role === 'admin') {
      await this.page.waitForURL('**/admin/dashboard', { timeout: 30000 });
    } else if (user.role === 'staff') {
      await this.page.waitForURL('**/staff/dashboard', { timeout: 30000 });
    } else {
      await this.page.waitForURL('**/guest/dashboard', { timeout: 30000 });
    }

    // Verify login success
    await this.page.waitForLoadState('networkidle');
  }

  async logout() {
    // Click user menu or logout button
    const userMenu = await this.page.locator('[data-testid="user-menu"], .user-menu, button:has-text("Logout")');
    if (await userMenu.count() > 0) {
      await userMenu.first().click();
    }

    // Click logout option
    await this.page.click('text=Logout, text=Sign Out, button:has-text("Logout")');

    // Wait for redirect to homepage or login
    await this.page.waitForURL(/\/(login|$)/, { timeout: 10000 });
  }

  async register(email?: string, password?: string, name?: string) {
    const uniqueEmail = email || `test.${Date.now()}@example.com`;
    const userPassword = password || 'Test@123456';
    const userName = name || 'Test User';

    // Navigate to register page
    await this.page.goto('/register');

    // Fill registration form
    await this.page.fill('input[name="name"]', userName);
    await this.page.fill('input[name="email"]', uniqueEmail);
    await this.page.fill('input[name="password"]', userPassword);

    // Confirm password if field exists
    const confirmPasswordField = await this.page.locator('input[name="confirmPassword"], input[name="confirm_password"]');
    if (await confirmPasswordField.count() > 0) {
      await confirmPasswordField.fill(userPassword);
    }

    // Accept terms if checkbox exists
    const termsCheckbox = await this.page.locator('input[type="checkbox"][name="terms"], input[type="checkbox"][name="acceptTerms"]');
    if (await termsCheckbox.count() > 0) {
      await termsCheckbox.check();
    }

    // Submit registration
    await this.page.click('button[type="submit"]:has-text("Register"), button[type="submit"]:has-text("Sign Up")');

    // Wait for success
    await this.page.waitForURL('**/dashboard', { timeout: 30000 });

    return { email: uniqueEmail, password: userPassword, name: userName };
  }

  async isLoggedIn(): Promise<boolean> {
    // Check for common logged-in indicators
    const indicators = [
      '[data-testid="user-menu"]',
      '.user-menu',
      'button:has-text("Logout")',
      'text=Dashboard',
      '[href*="/dashboard"]'
    ];

    for (const indicator of indicators) {
      const element = await this.page.locator(indicator);
      if (await element.count() > 0) {
        return true;
      }
    }

    return false;
  }

  async getCurrentUser(): Promise<string | null> {
    // Try to get current user info from various possible locations
    const userNameSelectors = [
      '[data-testid="user-name"]',
      '.user-name',
      '.user-info',
      '[class*="user-profile"]'
    ];

    for (const selector of userNameSelectors) {
      const element = await this.page.locator(selector);
      if (await element.count() > 0) {
        return await element.first().innerText();
      }
    }

    return null;
  }
}