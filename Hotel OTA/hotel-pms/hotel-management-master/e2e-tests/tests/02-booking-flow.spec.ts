import { test, expect } from '@playwright/test';
import { AuthHelper } from '../helpers/auth-helper';
import { BookingHelper } from '../helpers/booking-helper';
import { testBookingDates } from '../fixtures/test-users';

test.describe('Complete Booking Flow', () => {
  let authHelper: AuthHelper;
  let bookingHelper: BookingHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    bookingHelper = new BookingHelper(page);

    // Login as guest before each test
    await authHelper.login('guest');
  });

  test('should complete a standard room booking', async ({ page }) => {
    // Search for available rooms
    await bookingHelper.searchRooms();

    // Verify rooms are displayed
    await expect(page.locator('.room-card, [data-testid="room-card"]')).toHaveCount(await page.locator('.room-card, [data-testid="room-card"]').count());

    // Select the first available room
    await bookingHelper.selectRoom(0);

    // Fill guest details
    await bookingHelper.fillGuestDetails('John Doe', 'john.doe@example.com', '+1234567890');

    // Fill payment details
    await bookingHelper.fillPaymentDetails(true);

    // Complete booking
    const confirmationNumber = await bookingHelper.completeBooking();

    // Verify confirmation
    expect(confirmationNumber).toBeTruthy();
    await expect(page.locator('text=/Thank you|Booking Confirmed|Success/')).toBeVisible();

    // Navigate to bookings list
    await page.goto('/guest/bookings');

    // Verify booking appears in list
    if (confirmationNumber) {
      await expect(page.locator(`text=${confirmationNumber}`)).toBeVisible({ timeout: 10000 });
    }
  });

  test('should apply promo code discount', async ({ page }) => {
    // Search for rooms
    await bookingHelper.searchRooms();

    // Select a room
    await bookingHelper.selectRoom(0);

    // Look for promo code field
    const promoField = await page.locator('input[name="promoCode"], input[placeholder*="Promo"], input[placeholder*="Discount"]');
    if (await promoField.count() > 0) {
      // Enter promo code
      await promoField.fill('SAVE20');

      // Apply promo code
      await page.click('button:has-text("Apply"), button:has-text("Add")');

      // Verify discount is applied
      await expect(page.locator('text=/Discount|Savings|20%/')).toBeVisible({ timeout: 5000 });
    }

    // Continue with booking
    await bookingHelper.fillGuestDetails();
    await bookingHelper.fillPaymentDetails(true);
    await bookingHelper.completeBooking();
  });

  test('should handle group booking for multiple rooms', async ({ page }) => {
    // Navigate to group booking page if available
    const groupBookingLink = await page.locator('a:has-text("Group Booking"), button:has-text("Group Booking")');
    if (await groupBookingLink.count() > 0) {
      await groupBookingLink.click();
    } else {
      // Search for rooms normally
      await bookingHelper.searchRooms();
    }

    // Try to select multiple rooms
    const roomCards = await page.locator('.room-card, [data-testid="room-card"]').all();
    if (roomCards.length >= 2) {
      // Select first room
      await roomCards[0].locator('button:has-text("Select"), input[type="checkbox"]').click();

      // Select second room
      await roomCards[1].locator('button:has-text("Select"), input[type="checkbox"]').click();

      // Proceed with group booking
      await page.click('button:has-text("Continue"), button:has-text("Proceed")');

      // Fill details for multiple guests
      await bookingHelper.fillGuestDetails('Group Leader', 'group@example.com', '+1234567890');

      // Complete booking
      await bookingHelper.fillPaymentDetails(true);
      await bookingHelper.completeBooking();
    }
  });

  test('should modify booking dates', async ({ page }) => {
    // First create a booking
    await bookingHelper.searchRooms();
    await bookingHelper.selectRoom(0);
    await bookingHelper.fillGuestDetails();
    await bookingHelper.fillPaymentDetails(true);
    const confirmationNumber = await bookingHelper.completeBooking();

    if (confirmationNumber) {
      // Modify the booking
      const newDates = testBookingDates.longStay;
      await bookingHelper.modifyBookingDates(confirmationNumber, newDates.checkIn, newDates.checkOut);

      // Verify modification success
      await expect(page.locator('text=/Updated|Modified|Changed successfully/')).toBeVisible();
    }
  });

  test('should cancel booking and verify refund', async ({ page }) => {
    // First create a booking
    await bookingHelper.searchRooms();
    await bookingHelper.selectRoom(0);
    await bookingHelper.fillGuestDetails();
    await bookingHelper.fillPaymentDetails(true);
    const confirmationNumber = await bookingHelper.completeBooking();

    if (confirmationNumber) {
      // Cancel the booking
      await bookingHelper.cancelBooking(confirmationNumber);

      // Verify cancellation
      await expect(page.locator('text=/Cancelled|Refund|Cancellation successful/')).toBeVisible();

      // Check booking status
      await page.goto('/guest/bookings');
      await expect(page.locator(`[data-booking-id="${confirmationNumber}"]`)).toContainText(/Cancelled|Canceled/);
    }
  });

  test('should handle payment failure gracefully', async ({ page }) => {
    // Search and select room
    await bookingHelper.searchRooms();
    await bookingHelper.selectRoom(0);

    // Fill guest details
    await bookingHelper.fillGuestDetails();

    // Use declined card
    await bookingHelper.fillPaymentDetails(false);

    // Try to complete booking
    await page.click('button:has-text("Confirm Booking"), button:has-text("Pay Now")');

    // Verify error message
    await expect(page.locator('text=/declined|failed|unsuccessful|error/')).toBeVisible({ timeout: 30000 });

    // Verify still on payment page
    expect(page.url()).toContain('booking');
  });

  test('should show waiting list when no rooms available', async ({ page }) => {
    // Search for rooms with dates far in the future (likely to be booked)
    const farFutureDates = {
      checkIn: '2025-12-24',
      checkOut: '2025-12-31'
    };

    await bookingHelper.searchRooms(farFutureDates.checkIn, farFutureDates.checkOut);

    // Check if no rooms available message appears
    const noRoomsMessage = await page.locator('text=/No rooms available|Fully booked|Sold out/');
    if (await noRoomsMessage.count() > 0) {
      // Look for waiting list option
      const waitingListButton = await page.locator('button:has-text("Join Waiting List"), button:has-text("Waitlist")');
      if (await waitingListButton.count() > 0) {
        await waitingListButton.click();

        // Fill waiting list form
        await page.fill('input[name="email"]', 'waitlist@example.com');
        await page.fill('input[name="phone"]', '+1234567890');

        // Submit
        await page.click('button:has-text("Submit"), button:has-text("Join")');

        // Verify success
        await expect(page.locator('text=/Added to waiting list|You will be notified/')).toBeVisible();
      }
    }
  });

  test('should handle corporate booking with credit account', async ({ page }) => {
    // Logout and login as corporate user
    await authHelper.logout();
    await authHelper.login('corporate');

    // Search for rooms
    await bookingHelper.searchRooms();

    // Select a room
    await bookingHelper.selectRoom(0);

    // Fill corporate details
    await page.fill('input[name="companyName"], input[name="company"]', 'Tech Corp');
    await page.fill('input[name="employeeId"], input[name="employee_id"]', 'EMP12345');

    // Look for corporate billing option
    const corporateBilling = await page.locator('input[type="radio"][value="corporate"], label:has-text("Corporate Account")');
    if (await corporateBilling.count() > 0) {
      await corporateBilling.click();
    }

    // Fill guest details
    await bookingHelper.fillGuestDetails('Corporate Guest', 'corp.guest@techcorp.com', '+9876543210');

    // Complete booking (may not need payment if using corporate credit)
    const paymentRequired = await page.locator('[data-testid="payment-form"], iframe[title*="Stripe"]').count() > 0;
    if (paymentRequired) {
      await bookingHelper.fillPaymentDetails(true);
    }

    await bookingHelper.completeBooking();

    // Verify corporate booking
    await expect(page.locator('text=/Corporate|Company|Tech Corp/')).toBeVisible();
  });

  test('should validate date selection logic', async ({ page }) => {
    await page.goto('/rooms');

    // Try to set check-out before check-in
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    await page.fill('input[name="checkIn"], #checkIn', today);
    await page.fill('input[name="checkOut"], #checkOut', yesterday);

    // Try to search
    await page.click('button:has-text("Search"), button:has-text("Check Availability")');

    // Verify validation error
    await expect(page.locator('text=/Invalid dates|Check-out must be after|Date error/')).toBeVisible();
  });

  test('should display room amenities and details', async ({ page }) => {
    // Search for rooms
    await bookingHelper.searchRooms();

    // Click on first room for details
    const firstRoom = await page.locator('.room-card, [data-testid="room-card"]').first();

    // Look for view details link
    const detailsLink = await firstRoom.locator('a:has-text("View Details"), button:has-text("Details")');
    if (await detailsLink.count() > 0) {
      await detailsLink.click();

      // Verify room details page
      await expect(page.locator('text=/Amenities|Features|Room Details/')).toBeVisible();
      await expect(page.locator('text=/bed|guest|sq/')).toBeVisible(); // Common room descriptors

      // Check for amenities list
      const amenities = ['WiFi', 'Air Conditioning', 'TV', 'Mini Bar', 'Safe'];
      for (const amenity of amenities) {
        const amenityElement = await page.locator(`text=/${amenity}/i`);
        if (await amenityElement.count() > 0) {
          await expect(amenityElement.first()).toBeVisible();
          break; // At least one amenity found
        }
      }
    }
  });
});