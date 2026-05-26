import logger from './utils/logger';

/**
 * THE PENTOUZ Hotel Booking Widget
 * Embeddable booking widget for external websites
 * Version: 2.0.0
 */

(function(window, document, undefined) {
  'use strict';

  // Widget configuration and state
  let widgetConfig = {};
  let trackingId = null;
  let sessionId = null;

  const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:4000/api/v1'
    : 'https://hotel-management-xcsx.onrender.com/api/v1';

  // Generate unique session ID for tracking
  function generateSessionId() {
    return 'widget_' + Date.now() + '_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9));
  }

  // Track widget events for analytics
  async function trackWidgetEvent(event, data = {}) {
    try {
      const payload = {
        widgetId: widgetConfig.widgetId,
        sessionId: sessionId,
        event: event,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        referrer: document.referrer,
        userAgent: navigator.userAgent,
        screenResolution: `${screen.width}x${screen.height}`,
        viewportSize: `${window.innerWidth}x${window.innerHeight}`,
        ...data
      };

      // Send tracking data to backend
      await fetch(`${API_BASE_URL}/booking-engine/widget/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.warn('Widget tracking failed:', error);
    }
  }

  // Create widget CSS styles
  function createWidgetStyles() {
    const css = `
      .pentouz-booking-widget {
        font-family: ${widgetConfig.theme?.fontFamily || 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'};
        max-width: 100%;
        background: white;
        border-radius: ${widgetConfig.theme?.borderRadius || '8px'};
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        overflow: hidden;
        position: relative;
      }

      .pentouz-widget-inline {
        width: 100%;
        border: 1px solid #e5e7eb;
      }

      .pentouz-widget-popup {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 10000;
        width: 90%;
        max-width: 600px;
        max-height: 90vh;
        overflow-y: auto;
      }

      .pentouz-widget-sidebar {
        position: fixed;
        top: 0;
        right: 0;
        width: 350px;
        height: 100vh;
        z-index: 10000;
        overflow-y: auto;
      }

      .pentouz-widget-floating {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 300px;
        z-index: 10000;
      }

      .pentouz-widget-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999;
      }

      .pentouz-widget-header {
        background: linear-gradient(135deg, ${widgetConfig.theme?.primaryColor || '#3b82f6'} 0%, ${widgetConfig.theme?.secondaryColor || '#1d4ed8'} 100%);
        color: white;
        padding: 20px;
        text-align: center;
      }

      .pentouz-widget-title {
        font-size: 24px;
        font-weight: 600;
        margin: 0 0 5px 0;
      }

      .pentouz-widget-subtitle {
        font-size: 14px;
        opacity: 0.9;
        margin: 0;
      }

      .pentouz-widget-form {
        padding: 20px;
      }

      .pentouz-form-group {
        margin-bottom: 16px;
      }

      .pentouz-form-label {
        display: block;
        font-size: 14px;
        font-weight: 500;
        color: ${widgetConfig.theme?.textColor || '#374151'};
        margin-bottom: 6px;
      }

      .pentouz-form-input {
        width: 100%;
        padding: 12px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 14px;
        transition: border-color 0.2s;
        box-sizing: border-box;
      }

      .pentouz-form-input:focus {
        outline: none;
        border-color: ${widgetConfig.theme?.primaryColor || '#3b82f6'};
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }

      .pentouz-form-row {
        display: flex;
        gap: 12px;
      }

      .pentouz-form-row .pentouz-form-group {
        flex: 1;
      }

      .pentouz-btn {
        background: ${widgetConfig.theme?.primaryColor || '#3b82f6'};
        color: white;
        border: none;
        padding: 14px 28px;
        border-radius: 6px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        width: 100%;
        transition: background-color 0.2s;
      }

      .pentouz-btn:hover {
        background: ${widgetConfig.theme?.primaryColor || '#2563eb'};
      }

      .pentouz-btn:disabled {
        background: #9ca3af;
        cursor: not-allowed;
      }

      .pentouz-widget-close {
        position: absolute;
        top: 15px;
        right: 15px;
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .pentouz-widget-powered {
        text-align: center;
        padding: 10px;
        font-size: 12px;
        color: #6b7280;
        background: #f9fafb;
        border-top: 1px solid #e5e7eb;
      }

      .pentouz-widget-powered a {
        color: ${widgetConfig.theme?.primaryColor || '#3b82f6'};
        text-decoration: none;
      }

      .pentouz-loading {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 40px;
      }

      .pentouz-spinner {
        width: 40px;
        height: 40px;
        border: 4px solid #f3f4f6;
        border-top: 4px solid ${widgetConfig.theme?.primaryColor || '#3b82f6'};
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .pentouz-error {
        background: #fef2f2;
        border: 1px solid #fecaca;
        color: #dc2626;
        padding: 12px;
        border-radius: 6px;
        margin-bottom: 16px;
        font-size: 14px;
      }

      .pentouz-success {
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        color: #166534;
        padding: 12px;
        border-radius: 6px;
        margin-bottom: 16px;
        font-size: 14px;
      }

      @media (max-width: 768px) {
        .pentouz-widget-popup {
          width: 95%;
          max-height: 95vh;
        }

        .pentouz-widget-sidebar {
          width: 100%;
        }

        .pentouz-widget-floating {
          width: 280px;
          bottom: 10px;
          right: 10px;
        }

        .pentouz-form-row {
          flex-direction: column;
          gap: 0;
        }
      }
    `;

    const styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }

  // Create widget HTML structure
  function createWidgetHTML() {
    return `
      <div class="pentouz-widget-header">
        ${widgetConfig.type !== 'inline' ? '<button class="pentouz-widget-close" onclick="HotelBookingWidget.close()">&times;</button>' : ''}
        <h3 class="pentouz-widget-title">Book Your Stay</h3>
        <p class="pentouz-widget-subtitle">Best rates guaranteed • Free cancellation</p>
      </div>

      <form class="pentouz-widget-form" id="pentouz-booking-form">
        <div id="pentouz-widget-messages"></div>

        <div class="pentouz-form-row">
          <div class="pentouz-form-group">
            <label class="pentouz-form-label" for="checkin">Check-in Date</label>
            <input type="date" id="checkin" name="checkin" class="pentouz-form-input" required>
          </div>
          <div class="pentouz-form-group">
            <label class="pentouz-form-label" for="checkout">Check-out Date</label>
            <input type="date" id="checkout" name="checkout" class="pentouz-form-input" required>
          </div>
        </div>

        <div class="pentouz-form-row">
          <div class="pentouz-form-group">
            <label class="pentouz-form-label" for="adults">Adults</label>
            <select id="adults" name="adults" class="pentouz-form-input" required>
              <option value="1">1 Adult</option>
              <option value="2" selected>2 Adults</option>
              <option value="3">3 Adults</option>
              <option value="4">4 Adults</option>
              <option value="5">5+ Adults</option>
            </select>
          </div>
          <div class="pentouz-form-group">
            <label class="pentouz-form-label" for="children">Children</label>
            <select id="children" name="children" class="pentouz-form-input">
              <option value="0" selected>0 Children</option>
              <option value="1">1 Child</option>
              <option value="2">2 Children</option>
              <option value="3">3 Children</option>
              <option value="4">4+ Children</option>
            </select>
          </div>
        </div>

        <div class="pentouz-form-group">
          <label class="pentouz-form-label" for="roomType">Room Type</label>
          <select id="roomType" name="roomType" class="pentouz-form-input" required>
            <option value="">Select Room Type</option>
            <option value="standard">Standard Room</option>
            <option value="deluxe">Deluxe Room</option>
            <option value="suite">Suite</option>
            <option value="premium">Premium Room</option>
          </select>
        </div>

        <div class="pentouz-form-group">
          <label class="pentouz-form-label" for="promoCode">Promo Code (Optional)</label>
          <input type="text" id="promoCode" name="promoCode" class="pentouz-form-input" placeholder="Enter promo code">
        </div>

        <button type="submit" class="pentouz-btn" id="pentouz-search-btn">
          Search Available Rooms
        </button>
      </form>

      <div class="pentouz-widget-powered">
        Powered by <a href="#" target="_blank">THE PENTOUZ</a>
      </div>
    `;
  }

  // Initialize date inputs with today and tomorrow
  function initializeDates() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const checkinInput = document.getElementById('checkin');
    const checkoutInput = document.getElementById('checkout');

    if (checkinInput && checkoutInput) {
      checkinInput.value = today.toISOString().split('T')[0];
      checkinInput.min = today.toISOString().split('T')[0];

      checkoutInput.value = tomorrow.toISOString().split('T')[0];
      checkoutInput.min = tomorrow.toISOString().split('T')[0];

      // Update checkout min date when checkin changes
      checkinInput.addEventListener('change', function() {
        const selectedDate = new Date(this.value);
        const minCheckout = new Date(selectedDate);
        minCheckout.setDate(minCheckout.getDate() + 1);
        checkoutInput.min = minCheckout.toISOString().split('T')[0];

        if (checkoutInput.value <= this.value) {
          checkoutInput.value = minCheckout.toISOString().split('T')[0];
        }
      });
    }
  }

  // Show message in widget
  function showMessage(message, type = 'error') {
    const messagesEl = document.getElementById('pentouz-widget-messages');
    if (messagesEl) {
      messagesEl.innerHTML = `<div class="pentouz-${type}">${message}</div>`;
      setTimeout(() => {
        messagesEl.innerHTML = '';
      }, 5000);
    }
  }

  // Handle form submission
  async function handleFormSubmit(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);
    const submitBtn = document.getElementById('pentouz-search-btn');

    // Disable submit button and show loading
    submitBtn.disabled = true;
    submitBtn.textContent = 'Searching...';

    try {
      // Track form submission
      await trackWidgetEvent('form_submit', {
        checkin: formData.get('checkin'),
        checkout: formData.get('checkout'),
        adults: formData.get('adults'),
        children: formData.get('children'),
        roomType: formData.get('roomType'),
        promoCode: formData.get('promoCode') || null
      });

      // Prepare booking data
      const bookingData = {
        widgetId: widgetConfig.widgetId,
        sessionId: sessionId,
        checkIn: formData.get('checkin'),
        checkOut: formData.get('checkout'),
        adults: parseInt(formData.get('adults')),
        children: parseInt(formData.get('children')),
        roomType: formData.get('roomType'),
        promoCode: formData.get('promoCode') || null,
        source: 'widget',
        referrer: document.referrer,
        currentUrl: window.location.href
      };

      // Redirect to booking page with widget data
      const bookingUrl = new URL(widgetConfig.bookingUrl || `${API_BASE_URL.replace('/api/v1', '')}/booking`);

      // Add booking data as URL parameters
      Object.entries(bookingData).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          bookingUrl.searchParams.set(key, value);
        }
      });

      // Track conversion
      await trackWidgetEvent('conversion', bookingData);

      // Open booking page
      if (widgetConfig.openInNewTab) {
        window.open(bookingUrl.toString(), '_blank');
      } else {
        window.location.href = bookingUrl.toString();
      }

      showMessage('Redirecting to booking page...', 'success');

    } catch (error) {
      console.error('Booking submission error:', error);
      showMessage('Unable to process your request. Please try again.', 'error');

      // Track error
      await trackWidgetEvent('error', {
        error: error.message,
        step: 'form_submit'
      });
    } finally {
      // Re-enable submit button
      submitBtn.disabled = false;
      submitBtn.textContent = 'Search Available Rooms';
    }
  }

  // Create and show widget based on type
  function createWidget() {
    const widgetContainer = document.getElementById(`booking-widget-${widgetConfig.widgetId}`);
    if (!widgetContainer) {
      logger.error('Widget container not found');
      return;
    }

    // Create widget element
    const widget = document.createElement('div');
    widget.className = `pentouz-booking-widget pentouz-widget-${widgetConfig.type}`;
    widget.innerHTML = createWidgetHTML();

    // Create overlay for popup and sidebar types
    let overlay = null;
    if (widgetConfig.type === 'popup' || widgetConfig.type === 'sidebar') {
      overlay = document.createElement('div');
      overlay.className = 'pentouz-widget-overlay';
      overlay.onclick = () => HotelBookingWidget.close();
      document.body.appendChild(overlay);
    }

    // Add widget to page
    if (widgetConfig.type === 'inline') {
      widgetContainer.appendChild(widget);
    } else {
      document.body.appendChild(widget);
    }

    // Initialize form functionality
    initializeDates();

    // Add form submit handler
    const form = document.getElementById('pentouz-booking-form');
    if (form) {
      form.addEventListener('submit', handleFormSubmit);
    }

    // Store references for cleanup
    window.pentouzWidget = {
      element: widget,
      overlay: overlay,
      container: widgetContainer
    };

    // Track widget load
    trackWidgetEvent('widget_loaded', {
      type: widgetConfig.type,
      loadTime: Date.now() - window.pentouzWidgetStartTime
    });
  }

  // Public API
  window.HotelBookingWidget = {
    init: function(config) {
      widgetConfig = { ...config };
      sessionId = generateSessionId();
      trackingId = generateSessionId();
      window.pentouzWidgetStartTime = Date.now();

      // Track impression
      trackWidgetEvent('impression', {
        widgetId: config.widgetId,
        type: config.type || 'inline'
      });

      // Create styles and widget
      createWidgetStyles();

      // Create widget immediately for inline, or wait for trigger for others
      if (config.type === 'inline') {
        createWidget();
      } else {
        // For popup/sidebar/floating, create widget when needed
        this.show = createWidget;
      }

      console.log('THE PENTOUZ Booking Widget initialized:', config.widgetId);
    },

    show: function() {
      if (!window.pentouzWidget) {
        createWidget();
      }
      trackWidgetEvent('widget_shown');
    },

    close: function() {
      if (window.pentouzWidget) {
        if (window.pentouzWidget.element) {
          window.pentouzWidget.element.remove();
        }
        if (window.pentouzWidget.overlay) {
          window.pentouzWidget.overlay.remove();
        }
        window.pentouzWidget = null;

        trackWidgetEvent('widget_closed');
      }
    },

    track: function(event, data) {
      trackWidgetEvent(event, data);
    }
  };

  // Auto-show for floating widgets after page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(() => {
        if (widgetConfig.type === 'floating' && widgetConfig.autoShow !== false) {
          HotelBookingWidget.show();
        }
      }, widgetConfig.autoShowDelay || 3000);
    });
  }

})(window, document);