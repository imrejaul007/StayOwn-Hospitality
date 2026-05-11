# Front Desk Dashboard - Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Create Test User
```bash
cd backend
node src/scripts/createFrontdeskUser.js
```

Expected output:
```
✅ Frontdesk user created successfully!
📧 Email: frontdesk@hotel.com
🔑 Password: frontdesk123
```

### Step 2: Restart Servers (You'll do this manually as instructed)

### Step 3: Login and Test
1. Go to: http://localhost:5173/login
2. Login with:
   - **Email:** frontdesk@hotel.com
   - **Password:** frontdesk123
3. You'll be redirected to `/frontdesk` dashboard

---

## 📍 Quick Links to Test

After logging in as frontdesk user, visit:

### ✅ Full Access Pages
- `/frontdesk` - Dashboard
- `/frontdesk/upcoming-bookings` - Upcoming Arrivals
- `/frontdesk/housekeeping` - Housekeeping
- `/frontdesk/billing` - Billing & Payment
- `/frontdesk/my-approvals` - My Approval Requests

### 🔒 Restricted Pages
- `/frontdesk/rooms` - **View Only** (should show alert)
- `/frontdesk/room-types` - **No Add Button** (price changes need approval)
- `/frontdesk/tape-chart` - **Limited View** (only main chart)
- `/frontdesk/bookings` - **No Revenue** (total revenue hidden)
- `/frontdesk/corporate` - **2 Tabs Only** (Company Management, Group Bookings)

### ❌ Should Redirect
- `/admin` - Should redirect to `/frontdesk`
- `/staff` - Should redirect to `/frontdesk`

---

## 🧪 Test Approval Workflow

### As Frontdesk User:
1. Go to `/frontdesk/room-types`
2. Click "Request Price Change" on any room type
3. Enter new price: `6000`
4. Enter reason: "Seasonal price adjustment for peak season"
5. Click "Submit for Approval"
6. Go to `/frontdesk/my-approvals` to see pending request

### As Admin User:
1. Logout and login as admin:
   - Email: `admin@hotel.com`
   - Password: `admin123`
2. Go to `/admin/approval-management`
3. You should see the pending request
4. Click "Review"
5. Click "Approve" and add notes (optional)
6. Click "Confirm Approval"

### Verify:
1. Login back as frontdesk
2. Go to `/frontdesk/my-approvals`
3. Request should show as "Approved" ✅
4. Go to `/frontdesk/room-types`
5. Price should be updated to `6000`

---

## 🎯 What to Look For

### Dashboard Features
- [ ] Quick stats showing bookings, arrivals, rooms, approvals
- [ ] Quick actions with 4 cards
- [ ] Today's schedule section
- [ ] Pending approval alert (if you have pending requests)

### Header Features
- [ ] Property selector dropdown
- [ ] Notification bell with badge (if pending approvals)
- [ ] User profile menu

### Permission Restrictions
- [ ] Rooms page shows yellow alert "View only"
- [ ] Room Types has no "Add Room Type" button
- [ ] Room Types shows "Request Price Change" instead of "Edit"
- [ ] Bookings page doesn't show "Total Revenue" card
- [ ] Corporate page only shows 2 tabs

### Approval System
- [ ] Can create price change requests
- [ ] Requests show in "My Approvals" page
- [ ] Status updates to Approved/Rejected
- [ ] Admin can review and approve/reject
- [ ] Approved changes apply automatically

---

## 🐛 Troubleshooting

### Issue: Can't login as frontdesk
**Solution:** Run the user creation script again
```bash
cd backend
node src/scripts/createFrontdeskUser.js
```

### Issue: Redirected to wrong page
**Solution:** Clear browser cache and cookies, then login again

### Issue: Pages not loading
**Solution:**
1. Check both servers are running
2. Check browser console for errors
3. Check network tab for failed API calls

### Issue: Approval not working
**Solution:**
1. Check backend server console for errors
2. Verify approval routes are registered in server.js
3. Check database connection

---

## 📧 All Demo Credentials

```
Admin:         admin@hotel.com / admin123
Front Desk:    frontdesk@hotel.com / frontdesk123
Staff:         staff@hotel.com / staff123
Guest:         john@example.com / guest123
```

---

## ✅ Quick Checklist

Before reporting issues, verify:
- [ ] Backend server is running on port 5001
- [ ] Frontend server is running on port 5173
- [ ] Database connection is successful
- [ ] Test user was created successfully
- [ ] Both servers restarted after creating user
- [ ] Browser cache cleared
- [ ] Logged in with correct credentials
- [ ] Using Chrome/Firefox (not IE)

---

## 📝 File Locations

### Created Test User Script
```
backend/src/scripts/createFrontdeskUser.js
```

### Main Documentation
```
.claude/context/FRONTDESK_DASHBOARD_COMPLETE.md
```

### Frontdesk Pages
```
frontend/src/pages/frontdesk/
```

### Approval Components
```
frontend/src/components/approvals/
frontend/src/pages/admin/ApprovalManagement.tsx
```

---

**Status:** ✅ Ready to Test
**Next:** Run user creation script and start testing!
