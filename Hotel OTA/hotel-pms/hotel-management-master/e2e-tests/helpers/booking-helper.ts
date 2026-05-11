import { Page } from '@playwright/test';
import { testCards, testBookingDates } from '../fixtures/test-users';

export class BookingHelper {
  constructor(private page: Page) {}

  async searchRooms(checkIn?: string, checkOut?: string, guests: number = 2) {
    const dates = testBookingDates.future;
    const checkInDate = checkIn || dates.checkIn;
    const checkOutDate = checkOut || dates.checkOut;

    // Navigate to booking page
    await this.page.goto('/rooms');

    // Fill search form
    await this.page.fill('input[name="checkIn"], input[name="check_in"], #checkIn', checkInDate);
    await this.page.fill('input[name="checkOut"], input[name="check_out"], #checkOut', checkOutDate);

    // Set number of guests if field exists
    const guestsField = await this.page.locator('input[name="guests"], select[name="guests"]');
    if (await guestsField.count() > 0) {
      if (await guestsField.first().evaluate(el => el.tagName) === 'SELECT') {
        await guestsField.selectOption(guests.toString());
      } else {
        await guestsField.fill(guests.toString());
      }
    }

    // Submit search
    await this.page.click('button:has-text("Search"), button:has-text("Check Availability")');

    // Wait for results
    await this.page.waitForSelector('.room-card, [data-testid="room-card"], .room-listing', { timeout: 30000 });
  }

  async selectRoom(roomIndex: number = 0) {
    // Wait for room cards to load
    await this.page.waitForSelector('.room-card, [data-testid="room-card"]');

    // Get all room cards
    const roomCards = await this.page.locator('.room-card, [data-testid="room-card"]').all();

    if (roomCards.length > roomIndex) {
      // Click the select button for the specified room
      await roomCards[roomIndex].locator('button:has-text("Select"), button:has-text("Book Now"), button:has-text("Reserve")').click();
    } else {
      throw new Error(`Room index ${roomIndex} not found. Only ${roomCards.length} rooms available.`);
    }

    // Wait for navigation to booking details
    await this.page.waitForURL(/\/(booking|reservation|checkout)/, { timeout: 30000 });
  }

  async fillGuestDetails(name?: string, email?: string, phone?: string) {
    const guestName = name || 'Test Guest';
    const guestEmail = email || `test.${Date.now()}@example.com`;
    const guestPhone = phone || '+1234567890';

    // Fill guest information
    await this.page.fill('input[name="name"], input[name="guestName"], input[name="full_name"]', guestName);
    await this.page.fill('input[name="email"], input[name="guestEmail"]', guestEmail);
    await this.page.fill('input[name="phone"], input[name="guestPhone"], input[name="phoneNumber"]', guestPhone);

    // Fill additional fields if present
    const addressField = await this.page.locator('input[name="address"], input[name="street_address"]');
    if (await addressField.count() > 0) {
      await addressField.fill('123 Test Street');
    }

    const cityField = await this.page.locator('input[name="city"]');
    if (await cityField.count() > 0) {
      await cityField.fill('Test City');
    }

    const zipField = await this.page.locator('input[name="zip"], input[name="zipCode"], input[name="postal_code"]');
    if (await zipField.count() > 0) {
      await zipField.fill('12345');
    }
  }

  async fillPaymentDetails(useValidCard: boolean = true) {
    const card = useValidCard ? testCards.valid : testCards.declined;

    // Wait for payment form
    await this.page.waitForSelector('iframe[title*="Stripe"], iframe[src*="stripe"], [data-testid="payment-form"]', { timeout: 30000 });

    // Check if using Stripe iframe
    const stripeIframe = await this.page.locator('iframe[title*="Stripe"], iframe[src*="stripe"]');
    if (await stripeIframe.count() > 0) {
      // Switch to Stripe iframe context
      const frame = this.page.frameLocator('iframe[title*="Stripe"], iframe[src*="stripe"]').first();

      // Fill card number
      await frame.locator('[placeholder*="Card number"], [placeholder*="1234"], input[name="cardnumber"]').fill(card.number);

      // Fill expiry
      await frame.locator('[placeholder*="MM"], [placeholder*="Expiry"], input[name="exp-date"]').fill(card.expiry);

      // Fill CVC
      await frame.locator('[placeholder*="CVC"], [placeholder*="CVV"], input[name="cvc"]').fill(card.cvc);

      // Fill ZIP if present
      const zipField = frame.locator('[placeholder*="ZIP"], [placeholder*="Postal"], input[name="postal"]');
      if (await zipField.count() > 0) {
        await zipField.fill(card.zip);
      }
    } else {
      // Direct payment form (non-iframe)
      await this.page.fill('input[name="cardNumber"], input[placeholder*="Card number"]', card.number);
      await this.page.fill('input[name="expiry"], input[placeholder*="MM/YY"]', card.expiry);
      await this.page.fill('input[name="cvc"], input[placeholder*="CVC"]', card.cvc);

      const zipField = await this.page.locator('input[name="zip"], input[placeholder*="ZIP"]');
      if (await zipField.count() > 0) {
        await zipField.fill(card.zip);
      }
    }
  }

  async completeBooking() {
    // Click confirm/pay button
    await this.page.click('button:has-text("Confirm Booking"), button:has-text("Pay Now"), button:has-text("Complete Booking")');

    // Wait for confirmation page
    await this.page.waitForURL(/\/(confirmation|success|booking\/\w+)/, { timeout: 60000 });

    // Get booking confirmation number if available
    const confirmationNumber = await this.getBookingConfirmationNumber();
    return confirmationNumber;
  }

  async getBookingConfirmationNumber(): Promise<string | null> {
    const selectors = [
      '[data-testid="booking-number"]',
      '[data-testid="confirmation-number"]',
      '.booking-number',
      '.confirmation-number',
      'text=/Booking #[A-Z0-9]+/',
      'text=/Confirmation: [A-Z0-9]+/'
    ];

    for (const selector of selectors) {
      const element = await this.page.locator(selector);
      if (await element.count() > 0) {
        const text = await element.first().innerText();
        // Extract the booking number from the text
        const match = text.match(/[A-Z0-9]{6,}/);
        if (match) {
          return match[0];
        }
      }
    }

    return null;
  }

  async cancelBooking(bookingNumber: string) {
    // Navigate to bookings page
    await this.page.goto('/guest/bookings');

    // Find and click on the booking
    await this.page.click(`text=${bookingNumber}, [data-booking-id="${bookingNumber}"]`);

    // Click cancel button
    await this.page.click('button:has-text("Cancel Booking"), button:has-text("Cancel Reservation")');

    // Confirm cancellation
    const confirmButton = await this.page.locator('button:has-text("Confirm"), button:has-text("Yes, Cancel")');
    if (await confirmButton.count() > 0) {
      await confirmButton.click();
    }

    // Wait for cancellation confirmation
    await this.page.waitForSelector('text=/Cancel(led|lation successful)/', { timeout: 30000 });
  }

  async modifyBookingDates(bookingNumber: string, newCheckIn: string, newCheckOut: string) {
    // Navigate to bookings page
    await this.page.goto('/guest/bookings');

    // Find and click on the booking
    await this.page.click(`text=${bookingNumber}, [data-booking-id="${bookingNumber}"]`);

    // Click modify button
    await this.page.click('button:has-text("Modify"), button:has-text("Change Dates")');

    // Update dates
    await this.page.fill('input[name="checkIn"], input[name="check_in"]', newCheckIn);
    await this.page.fill('input[name="checkOut"], input[name="check_out"]', newCheckOut);

    // Save changes
    await this.page.click('button:has-text("Update"), button:has-text("Save Changes")');

    // Wait for confirmation
    await this.page.waitForSelector('text=/Update(d| successful)/', { timeout: 30000 });
  }
}