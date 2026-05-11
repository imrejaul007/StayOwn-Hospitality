# Manual Test Guide: Guest Dashboard Walk-In Booking Display

**Purpose:** Verify that walk-in bookings created by admin for existing users appear in guest dashboard

---

## Prerequisites

1. **Backend running:** `http://localhost:5000`
2. **Frontend running:** `http://localhost:5173`
3. **Two user accounts:**
   - Admin account (to create walk-in booking)
   - Guest account: `mukulraj756@gmail.com`

---

## Test Steps

### **Step 1: Create Walk-In Booking (As Admin)**

1. **Login as Admin**
   - Navigate to: `http://localhost:5173/admin/login`
   - Enter admin credentials
   - Click "Login"

2. **Navigate to Bookings**
   - Click "Bookings" in admin sidebar
   - Or navigate to: `http://localhost:5173/admin/bookings`

3. **Create New Booking**
   - Click "New Booking" button
   - Fill in booking details:
     ```
     Booking Type: Walk-In
     Guest Email: mukulraj756@gmail.com
     (System will auto-fill guest details if user exists)

     Check-In Date: 2025-10-18
     Check-Out Date: 2025-10-20
     Room Type: Deluxe
     Room Number: 1001

     Adults: 2
     Children: 0

     Total Amount: ₹12,082
     Status: Confirmed
     Payment Status: Pending (or Partial/Paid if advance collected)
     ```

4. **Submit Booking**
   - Click "Create Booking"
   - Note the booking number (e.g., BK-2025-001234)
   - ✅ **Expected:** Success message "Booking created successfully"

5. **Verify in Admin View**
   - Booking should appear in admin bookings list
   - Status: Confirmed
   - Guest: mukulraj756@gmail.com

---

### **Step 2: Verify in Guest Dashboard (As Guest)**

1. **Logout from Admin**
   - Click profile icon
   - Click "Logout"

2. **Login as Guest**
   - Navigate to: `http://localhost:5173/login`
   - Enter credentials:
     ```
     Email: mukulraj756@gmail.com
     Password: <guest password>
     ```
   - Click "Login"

3. **Check Dashboard**
   - Should redirect to: `http://localhost:5173/guest/dashboard`
   - ✅ **Verify the following:**

   **Stats Cards:**
   ```
   ✅ Total Bookings: Should increase by 1
   ✅ Upcoming Bookings: Should show 1 (if check-in is in future)
   ✅ Total Spent: Should show correct amount
   ✅ Loyalty Points: Should display current points
   ```

   **Recent Bookings Section:**
   ```
   ✅ Should show the new booking in the list
   ✅ Hotel name should be displayed
   ✅ Dates: 2025-10-18 to 2025-10-20
   ✅ Booking number: BK-2025-001234
   ✅ Amount: ₹12,082
   ✅ Status badge: Confirmed (green)
   ```

4. **Navigate to My Bookings**
   - Click "My Bookings" in guest menu
   - Or click "View All" in Recent Bookings section
   - Or navigate to: `http://localhost:5173/guest/bookings`

5. **Verify in All Bookings Tab**
   - ✅ **Expected:** Booking should appear in list
   - Verify the following details:

   **Booking Card Header:**
   ```
   ✅ Hotel Name: Displayed
   ✅ Status Badge: Confirmed (green background)
   ✅ Booking Number: BK-2025-001234
   ✅ Address: Street, City, State
   ```

   **Booking Amount Section:**
   ```
   ✅ Total Amount: ₹12,082
   ✅ Payment Status: Pending/Paid (based on what was set)
   ✅ If price adjustments exist:
      - Original amount with strikethrough
      - Discount/surcharge badge
      - Savings amount
   ```

   **Booking Details:**
   ```
   ✅ Check-in: 2025-10-18
   ✅ Check-out: 2025-10-20
   ✅ Guests: 2 adults
   ✅ Room: 1001 - Deluxe
   ✅ Rate breakdown: 2 nights × rate/night
   ```

   **Action Buttons:**
   ```
   ✅ View Details - Should be visible
   ✅ Call Hotel - Should be visible
   ✅ Email Hotel - Should be visible
   ✅ Request Changes - Should be visible (if upcoming)
   ✅ Contact Hotel - Should be visible
   ✅ Generate Digital Key - Should be visible (if confirmed)
   ✅ Cancel - Should be visible (if > 24 hours before check-in)
   ```

6. **Check Upcoming Tab**
   - Click "Upcoming" tab
   - ✅ **Expected:** Booking should appear here if check-in is in future

7. **Click View Details**
   - Click "View Details" button on the booking
   - ✅ **Expected:** Should navigate to booking detail page
   - Verify all information is displayed correctly:
     ```
     ✅ Complete booking information
     ✅ Room details
     ✅ Guest details
     ✅ Price breakdown
     ✅ Payment history (if any)
     ✅ Special requests (if any)
     ✅ Price adjustments (if any)
     ```

---

## Test Scenarios

### **Scenario 1: Multiple Walk-In Bookings**

1. Create 3 walk-in bookings for same guest
2. Login as guest
3. ✅ **Verify:** All 3 bookings appear in dashboard
4. ✅ **Verify:** Total bookings count is correct

### **Scenario 2: Different Statuses**

1. Create bookings with different statuses:
   - Pending
   - Confirmed
   - Checked In (past check-in date)

2. Login as guest
3. ✅ **Verify:** All bookings appear in "All Bookings"
4. ✅ **Verify:** Filters work correctly:
   - Upcoming shows pending/confirmed with future check-in
   - Active shows checked_in
   - Past shows checked_out

### **Scenario 3: Price Adjustments**

1. Create walk-in booking
2. Admin applies discount/surcharge
3. Login as guest
4. ✅ **Verify:**
   - Original price shown with strikethrough
   - Discount/surcharge badge displayed
   - Savings amount shown
   - Price adjustment details visible

### **Scenario 4: Real-Time Updates**

1. Guest is logged in viewing dashboard
2. Admin creates new walk-in booking for this guest
3. Guest refreshes page or navigates away and back
4. ✅ **Verify:** New booking appears (within cache time of 5 minutes)

---

## Troubleshooting

### **Booking Not Appearing in Guest Dashboard**

**Check 1: User ID Match**
```javascript
// In backend console/logs, verify:
console.log('Booking userId:', booking.userId);
console.log('Guest user._id:', user._id);
// These should match
```

**Check 2: API Response**
```javascript
// Open browser DevTools > Network tab
// Filter: /bookings
// Check response:
{
  "status": "success",
  "results": 1,
  "data": [
    {
      "_id": "...",
      "userId": "<should match guest user ID>",
      // ... other fields
    }
  ]
}
```

**Check 3: React Query Cache**
```javascript
// In browser console:
localStorage.clear(); // Clear cache
// Then refresh page
```

**Check 4: Backend Logs**
```bash
# Check backend terminal for errors
# Look for:
# - Authentication errors
# - Database query errors
# - Population errors
```

---

## Expected Results Summary

| **Feature** | **Expected Behavior** | **Status** |
|------------|----------------------|-----------|
| Dashboard stats | Shows updated counts including walk-in booking | ✅ |
| Recent bookings | Displays last 5 bookings including walk-in | ✅ |
| All bookings tab | Shows all bookings regardless of source | ✅ |
| Upcoming tab | Shows future walk-in bookings | ✅ |
| Booking details | Complete information displayed | ✅ |
| Price adjustments | Shown if applied | ✅ |
| Action buttons | All relevant actions available | ✅ |
| Status filtering | Works correctly | ✅ |
| Real-time updates | Works after cache refresh | ✅ |

---

## Notes

1. **Cache Time:** React Query caches data for 5 minutes. If booking doesn't appear immediately, wait or force refresh.

2. **User ID:** Ensure the booking's `userId` exactly matches the guest's user ID.

3. **Source Field:** Walk-in bookings might have `source: 'direct'` or `source: 'walk_in'` - both should appear.

4. **Permissions:** Guest can only see their own bookings (filtered by `userId`).

5. **Browser Cache:** If issues persist, clear browser cache and localStorage.

---

## Test Report Template

Use this template to document your test results:

```markdown
# Test Execution Report

**Test Date:** ___________
**Tester:** ___________
**Environment:** Local Development

## Test Results

### Booking Creation (Admin)
- [ ] Admin can create walk-in booking
- [ ] Booking appears in admin view
- [ ] Correct guest email used
- [ ] Booking number generated: ___________

### Guest Dashboard
- [ ] Total bookings count increased
- [ ] Upcoming bookings count updated
- [ ] Recent bookings section shows new booking
- [ ] All details displayed correctly

### My Bookings Page
- [ ] Booking appears in "All Bookings" tab
- [ ] Booking appears in "Upcoming" tab
- [ ] Hotel name displayed
- [ ] Booking number matches
- [ ] Dates correct
- [ ] Amount correct
- [ ] Status correct
- [ ] Action buttons visible

### Booking Details
- [ ] View details works
- [ ] Complete information shown
- [ ] Room details visible
- [ ] Price breakdown correct

### Issues Found
List any issues:
1. ___________
2. ___________

### Overall Result
- [ ] ✅ All tests passed
- [ ] ❌ Some tests failed

**Notes:**
___________
```

---

**Document Version:** 1.0
**Last Updated:** 2025-10-18
