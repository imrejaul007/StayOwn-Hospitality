# 🏨 How to Add Properties & Enable Multi-Property Selector

**Problem:** You only have 1 property, so the Property Selector is hidden in the header.

**Solution:** Add more properties and assign them to your admin user.

---

## 🚀 Quick Start (2 Minutes)

### **Method 1: Using Scripts (Fastest)**

Run these two commands in your backend folder:

```bash
# Step 1: Add a second test property
cd backend
node src/scripts/addTestProperty.js

# Step 2: Assign all properties to your admin user
node src/scripts/assignPropertiesToUser.js admin@hotel.com
```

**Replace `admin@hotel.com` with your actual admin email!**

### **Result:**
- ✅ Second property created: "THE PENTOUZ Hotel2"
- ✅ Both properties assigned to your admin user
- ✅ Multi-property mode enabled
- ✅ Property Selector appears in header!

---

## 🎯 Method 2: Using the UI

### **Step 1: Add a New Property**

1. **Navigate to Multi-Property Management:**
   ```
   http://localhost:5173/admin/multi-property
   ```

2. **Click "Add Property" button**

3. **Fill in property details:**
   - Name: "THE PENTOUZ Hotel2"
   - Address: Street, City, State, Country, ZIP
   - Contact: Phone, Email, Website
   - Facilities: Rooms, Floors, Check-in/out times
   - Amenities: WiFi, Pool, Gym, etc.

4. **Click "Save"** → Property created!

### **Step 2: Assign Property to Your User**

1. **Navigate to User Management:**
   ```
   http://localhost:5173/admin/user-management
   ```

2. **Find your admin user** (search by email)

3. **Click Edit button** (✏️ pencil icon)

4. **Scroll to "Property Access" section:**
   - **Primary Property:** Select your main property
   - **Additional Properties:** Check boxes for all properties you want access to
   - **Multi-Property Permissions:**
     - ✅ Can create new properties
     - ✅ Can delete properties
     - ✅ Can manage property groups

5. **Click "Save Changes"**

6. **Refresh the page** → Property Selector appears!

---

## 🔍 What the Property Selector Looks Like

### **With 1 Property (Current):**
```
Header: 🏢 THE PENTOUZ Hotel1  (static badge, not clickable)
```

### **With 2+ Properties (After adding):**
```
Header: 🏢 THE PENTOUZ Hotel1 ▼  (clickable dropdown)

Click to open:
┌─────────────────────────────────────────┐
│  🏢 All Properties (Portfolio view)  ✓  │
├─────────────────────────────────────────┤
│  🏢 THE PENTOUZ Hotel1                  │
│     Mumbai, Maharashtra                 │
│                                          │
│  🏢 THE PENTOUZ Hotel2                  │
│     Mumbai, Maharashtra                 │
│                                          │
│  Showing 2 of 2 properties               │
└─────────────────────────────────────────┘
```

### **With 5+ Properties:**
- Search box appears at top
- Scrollbar for long list
- Filter by property name or city

---

## 📊 What Happens When You Select "All Properties"

When viewing "All Properties" (Portfolio Mode):

- ✅ **Dashboard:** Shows combined metrics from all properties
- ✅ **Bookings:** Shows bookings from all properties (with property filter)
- ✅ **Rooms:** Shows rooms from all properties
- ✅ **Analytics:** Portfolio-wide analytics and comparisons
- ✅ **Financial:** Cross-property revenue reports

---

## 🧪 Testing the Multi-Property Feature

After adding properties and restarting servers:

### **Test 1: Property Selector Visibility**
1. Reload page
2. ✅ Property Selector should appear in header
3. Click it → Dropdown opens

### **Test 2: Switch Between Properties**
1. Click Property Selector
2. Select "THE PENTOUZ Hotel2"
3. ✅ Dashboard updates with Hotel2's data
4. ✅ Rooms page shows Hotel2's rooms only

### **Test 3: Portfolio View**
1. Click Property Selector
2. Select "All Properties"
3. ✅ Dashboard shows combined metrics
4. ✅ Charts show comparison data

---

## 🛠️ Troubleshooting

### **Property Selector Still Not Showing?**

**Check 1: How many properties do you have?**
```bash
# In MongoDB shell or Compass
db.hotels.countDocuments({ active: true })
```
- Need at least 1 property (shows static badge)
- Need 2+ properties (shows dropdown)

**Check 2: Are properties assigned to your user?**
```bash
# In MongoDB shell or Compass
db.users.findOne({ email: "admin@hotel.com" }, { properties: 1, isMultiProperty: 1 })
```
Should show:
```json
{
  "properties": ["propertyId1", "propertyId2"],
  "isMultiProperty": true
}
```

**Check 3: Did you restart servers?**
```bash
# Backend
cd backend
# Stop (Ctrl+C) then restart:
npm start

# Frontend
cd frontend
# Stop (Ctrl+C) then restart:
npm run dev
```

**Check 4: Clear browser cache**
- Press `Ctrl + Shift + Delete`
- Clear cache and reload

---

## 📝 Database Manual Method

If scripts don't work, you can do it manually:

### **1. Add New Property in Database:**

Open MongoDB Compass or Mongo shell and insert:

```javascript
db.hotels.insertOne({
  name: "THE PENTOUZ Hotel2",
  address: {
    street: "456 Marine Drive",
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
    zipCode: "400020"
  },
  contact: {
    phone: "+91 22 2345 6789",
    email: "hotel2@pentouz.com"
  },
  facilities: {
    totalRooms: 150,
    totalFloors: 10,
    checkInTime: "14:00",
    checkOutTime: "11:00",
    amenities: ["WiFi", "Parking", "Pool", "Gym", "Restaurant"]
  },
  active: true,
  verified: true,
  createdAt: new Date(),
  updatedAt: new Date()
})
```

### **2. Get Property IDs:**

```javascript
db.hotels.find({}, { _id: 1, name: 1 })
```

Copy both property `_id` values.

### **3. Update User with Both Properties:**

```javascript
db.users.updateOne(
  { email: "admin@hotel.com" },
  {
    $set: {
      properties: [
        ObjectId("PASTE_PROPERTY_ID_1_HERE"),
        ObjectId("PASTE_PROPERTY_ID_2_HERE")
      ],
      hotelId: ObjectId("PASTE_PROPERTY_ID_1_HERE"), // Primary property
      isMultiProperty: true,
      multiPropertyAccess: {
        enabled: true,
        restrictions: {
          canCreateProperties: true,
          canDeleteProperties: true,
          canManageGroups: true
        }
      }
    }
  }
)
```

### **4. Restart Servers & Login**

---

## ✅ Success Checklist

After setup, you should have:

- [ ] At least 2 properties in database
- [ ] Admin user has both properties in `properties` array
- [ ] Admin user has `isMultiProperty: true`
- [ ] Property Selector visible in header
- [ ] Dropdown opens when clicked
- [ ] Can switch between properties
- [ ] Can view "All Properties" portfolio mode
- [ ] Dashboard updates based on selected property

---

## 🎉 You're Done!

Now you can:
- ✅ Switch between properties using the header dropdown
- ✅ View portfolio-wide analytics
- ✅ Manage multiple hotel properties
- ✅ Create property groups
- ✅ Compare performance across properties

---

**Questions?** Check the console logs or database to debug property assignments.

**Need more properties?** Run `addTestProperty.js` multiple times, or use the UI to create them!
