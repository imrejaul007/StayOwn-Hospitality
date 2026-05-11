# Hotel OTA Self-Service Onboarding - Audit Checklist

## Overview

This document outlines the audit checklist for the Hotel OTA Self-Service Onboarding feature. The onboarding flow allows hotel partners to set up their property in under 5 minutes.

## Onboarding Flow Summary

```
Step 1: Hotel Info -> Step 2: Room Setup -> Step 3: Services -> Step 4: Staff -> Step 5: Complete
   (~1 min)              (~2 min)           (~30 sec)          (~1 min)        (~30 sec)
```

**Total Estimated Time: < 5 minutes**

---

## Audit Checklist

### Step 1: Hotel Information

- [ ] Hotel Name field accepts input and validates (min 3 characters)
- [ ] Location auto-detection works (requires geolocation permission)
- [ ] Manual location entry works when auto-detect fails
- [ ] Hotel Type selection shows 6 options (Boutique, Business, Resort, Budget, Heritage, Homestay)
- [ ] Star Rating selection works (1-5 stars)
- [ ] Contact Phone validates format (+91 format)
- [ ] Contact Email is optional and auto-filled
- [ ] Form prevents submission with missing required fields
- [ ] Inline error messages display correctly
- [ ] Continue button shows loading state during save

### Step 2: Room Setup

- [ ] Room count selector works (slider + buttons)
- [ ] Auto-generate rooms creates sequential room numbers (101, 102, etc.)
- [ ] Manual editing of room number works
- [ ] Floor assignment is correct (auto-calculated)
- [ ] Room Type dropdown shows 4 options
- [ ] Price input accepts decimal values (stored as paise)
- [ ] Duplicate room number validation works
- [ ] QR code generation triggers on button click
- [ ] QR preview shows first 3 rooms
- [ ] Generated QR codes have room number label
- [ ] Large room counts (up to 500) work without performance issues
- [ ] Room list is scrollable after 50 rooms

### Step 3: Services Configuration

- [ ] 8 services available for selection
- [ ] Default services enabled: Room Service, Housekeeping, Laundry
- [ ] Click toggles service selection
- [ ] Visual feedback shows enabled/disabled state
- [ ] "Select All" button works
- [ ] "Reset to Defaults" button works
- [ ] Counter shows "X of Y services selected"
- [ ] Price range shown for each service
- [ ] Tip box displays helpful information

### Step 4: Staff Invitations

- [ ] Email input accepts valid email format
- [ ] Role dropdown shows 4 options (Manager, Front Desk, Housekeeping, Room Service)
- [ ] Add Another Team Member button works
- [ ] Remove button works (minimum 1 row)
- [ ] Empty emails are filtered out on submit
- [ ] Duplicate email validation works
- [ ] Invalid email format shows error
- [ ] Skip option works and continues without invites
- [ ] Preview shows valid emails to be invited

### Step 5: Completion

- [ ] Success animation plays
- [ ] Confetti effect displays briefly
- [ ] Hotel name shown in congratulations message
- [ ] Summary cards show correct counts (rooms, services, staff, QR codes)
- [ ] Rotating success messages display
- [ ] QR codes download button works
- [ ] Download creates JSON file with room QR data
- [ ] WhatsApp share button opens WhatsApp
- [ ] "Go to Dashboard" button navigates correctly
- [ ] "What's next" checklist shows correct items

### Progress Indicator

- [ ] Shows current step (Step X of 5)
- [ ] Completed steps show checkmark
- [ ] Current step highlighted with ring
- [ ] Step names displayed (Hotel Info, Room Setup, Services, Team, Complete)
- [ ] Time estimate updates based on remaining steps
- [ ] Mobile responsive (hides step names on small screens)

### Navigation & State

- [ ] Back button works from all steps
- [ ] Session persists in localStorage
- [ ] Page refresh restores session state
- [ ] Exit Setup link clears session
- [ ] Error banners display and can be dismissed
- [ ] Loading states display correctly

### API Routes

- [ ] `POST /v1/hotel/onboarding/start` - Creates session with token
- [ ] `POST /v1/hotel/onboarding/step-1` - Validates and saves hotel info
- [ ] `POST /v1/hotel/onboarding/step-2` - Saves rooms + generates QR codes
- [ ] `POST /v1/hotel/onboarding/step-3` - Saves services config
- [ ] `POST /v1/hotel/onboarding/step-4` - Saves staff invites
- [ ] `POST /v1/hotel/onboarding/complete` - Creates hotel in database
- [ ] `GET /v1/hotel/onboarding/session/:id` - Returns session status
- [ ] `POST /v1/hotel/onboarding/cancel` - Cancels session

### Error Handling

- [ ] Network errors show appropriate message
- [ ] Session expiry shows "Session expired" message
- [ ] Invalid token shows error
- [ ] Duplicate room numbers rejected
- [ ] Invalid emails rejected with specific message
- [ ] Empty required fields prevent submission

### Mobile Responsiveness

- [ ] Steps render correctly on mobile
- [ ] Hotel type grid responsive (2 cols on mobile, 3 on desktop)
- [ ] Service cards responsive (1 col on mobile, 2 on desktop)
- [ ] Progress indicator adapts to screen size
- [ ] QR preview scrollable on small screens

### Performance

- [ ] Initial page load < 2 seconds
- [ ] QR generation < 3 seconds for 100 rooms
- [ ] Session save < 500ms
- [ ] No memory leaks on long sessions
- [ ] Large room counts handled efficiently

---

## Test Scenarios

### Happy Path
1. Open onboarding with valid token
2. Complete all 5 steps without errors
3. Hotel created in database
4. Redirect to dashboard works

### Edge Cases
1. Token already used (should show error)
2. Session expires mid-onboarding (should show message)
3. Network disconnects (should show retry option)
4. Browser closes mid-onboarding (session restored on return)
5. Invalid email format entered
6. Duplicate room numbers entered

### Stress Tests
1. Generate 500 room QR codes
2. Add 50 staff members
3. Rapid step navigation

---

## Browser Compatibility

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

---

## Security Considerations

- [ ] Session tokens are UUIDs (not guessable)
- [ ] QR codes signed with HMAC-SHA256
- [ ] Expired QR codes rejected
- [ ] Staff invite tokens are cryptographically random
- [ ] Input sanitization on all fields
- [ ] Rate limiting on API endpoints

---

## Accessibility

- [ ] All form fields have labels
- [ ] Error messages are announced
- [ ] Keyboard navigation works
- [ ] Focus states visible
- [ ] Color contrast meets WCAG AA
- [ ] Screen reader compatible

---

## Files Created

### Frontend
```
apps/ota-web/src/app/onboarding/page.tsx
apps/ota-web/src/components/onboarding/OnboardingProgress.tsx
apps/ota-web/src/components/onboarding/Step1HotelInfo.tsx
apps/ota-web/src/components/onboarding/Step2Rooms.tsx
apps/ota-web/src/components/onboarding/Step3Services.tsx
apps/ota-web/src/components/onboarding/Step4Staff.tsx
apps/ota-web/src/components/onboarding/Step5Complete.tsx
apps/ota-web/src/lib/onboarding/api.ts
```

### Backend
```
apps/api/src/routes/hotel-onboarding/hotel-onboarding.routes.ts
apps/api/src/utils/generateRoomQR.ts
```

### Documentation
```
docs/ONBOARDING-AUDIT.md
```

---

## Dependencies Added

### Frontend
- None required (using native APIs)

### Backend
- `uuid` (already in package.json)

---

## Environment Variables Required

```
FRONTEND_URL=https://hotel-ota.vercel.app
ROOM_QR_SECRET=<secret-for-qr-signing>
```

---

## Database Schema Impact

New models created during onboarding:
- `Hotel` - with `onboardingCompleted` flag
- `RoomType` - linked to hotel
- `Room` - with QR code data
- `HotelService` - enabled services
- `HotelStaffInvite` - pending staff invitations

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-01-15 | Initial implementation |

---

## Sign-off

- [ ] Frontend Developer: _______________
- [ ] Backend Developer: _______________
- [ ] QA Engineer: _______________
- [ ] Product Owner: _______________

---

Last Updated: 2024-01-15
