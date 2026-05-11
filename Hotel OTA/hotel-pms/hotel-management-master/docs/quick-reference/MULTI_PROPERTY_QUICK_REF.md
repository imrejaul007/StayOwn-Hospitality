# Multi-Property Settings - Quick Reference Guide

**Version**: 2.0.0 | **THE PENTOUZ Hotel Management System**

---

## At a Glance: Multi-Property Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   YOUR PROPERTY PORTFOLIO                    │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │ Property     │    │ Property     │    │ Standalone   │ │
│  │ Group A      │    │ Group B      │    │ Properties   │ │
│  │ (8 hotels)   │    │ (5 hotels)   │    │ (3 hotels)   │ │
│  │              │    │              │    │              │ │
│  │ Inherits ←───┼────│ Inherits     │    │ Independent  │ │
│  │ settings     │    │ settings     │    │ management   │ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              THREE WAYS TO APPLY SETTINGS                    │
│                                                              │
│  1. THIS PROPERTY ONLY    →  Updates 1 property             │
│  2. PROPERTY GROUP        →  Updates group (e.g., 8)        │
│  3. ALL MY PROPERTIES     →  Updates entire portfolio       │
└─────────────────────────────────────────────────────────────┘
```

---

## The Three Scopes Explained

| Scope | Icon | When to Use | Properties Affected | Confirmation |
|-------|------|------------|---------------------|--------------|
| **This Property Only** | 🏢 | • Testing new settings<br>• Property-specific needs<br>• Creating overrides | 1 property | No |
| **Property Group** | 📁 | • Regional updates<br>• Related properties<br>• Brand consistency | All in group (e.g., 5-10) | Yes |
| **All My Properties** | 🌐 | • Company-wide policies<br>• System integrations<br>• Brand standards | All properties | Yes |

---

## Common Actions - Step by Step

### 1️⃣ Update Settings for One Property

```
1. Select property from dropdown (top right)
2. Navigate to settings page
3. Make your changes
4. Select: "This Property Only"
5. Click "Save"
6. Done! (No confirmation needed)
```

**Time**: ~1 minute | **Risk**: Low

---

### 2️⃣ Update Settings for a Property Group

```
1. Select any property in the group
2. Navigate to settings page
3. Make your changes
4. Select: "Property Group"
5. Click "Save"
6. Review confirmation:
   ✓ Count affected properties
   ✓ Check group name
   ✓ Read warnings
7. Click "Confirm Update"
8. Wait for success message
9. Verify on 2-3 sample properties
```

**Time**: ~2-3 minutes | **Risk**: Medium

---

### 3️⃣ Update Settings for All Properties

```
1. Select any property
2. Navigate to settings page
3. Make your changes
4. Select: "All My Properties"
5. Click "Save"
6. Review confirmation:
   ✓ Count should match total properties
   ✓ Read impact warning
   ✓ Verify this is intended
7. Click "Confirm Update"
8. Wait for completion (may take 10-60s)
9. Review success/error counts
10. Spot-check several properties
```

**Time**: ~5 minutes | **Risk**: High

**⚠️ Best Practice**: Test on single property first for critical changes

---

### 4️⃣ Create a Property Group

```
1. Go to: Admin → Portfolio Dashboard
2. Click: "Create Property Group"
3. Fill in:
   - Name: "Downtown Properties"
   - Type: Chain/Franchise/Management/Independent
   - Description: Purpose of group
4. Click: "Create Group"
5. Click: "Add Properties"
6. Select properties from list
7. Click: "Add Selected"
8. Configure group base settings (optional)
9. Done!
```

**Time**: ~5 minutes

---

### 5️⃣ Create an Override

```
1. Select the property
2. Go to settings page
3. Find setting to override
4. Make change
5. Select: "This Property Only"
6. Click "Save"
7. Override created!
8. Look for orange "!" indicator
```

**Time**: ~1 minute

---

### 6️⃣ Remove an Override

```
Method 1: Per Setting
1. Go to settings page with override
2. Click "Restore to Group Setting"
3. Confirm
4. Now inherits from group

Method 2: All Overrides
1. Go to Property Detail page
2. Click "Overrides" tab
3. Click "Restore All to Group Settings"
4. Confirm bulk restoration
```

**Time**: ~1-2 minutes

---

## UI Elements Reference

### ApplyTo Selector

```
┌─────────────────────────────────────────┐
│ ⓘ Apply Settings To                     │
├─────────────────────────────────────────┤
│ ○ This Property Only                    │ ← 1 property, no confirmation
│   Grand Hotel Downtown                   │
│                                          │
│ ○ Property Group                         │ ← All in group, needs confirmation
│   Downtown Properties (5 properties)     │
│                                          │
│ ○ All My Properties                      │ ← All properties, needs confirmation
│   All 12 properties you own             │
└─────────────────────────────────────────┘
```

**Where**: Appears on all 28 settings pages, usually above the form

---

### Confirmation Dialog

```
┌────────────────────────────────────────┐
│  ⚠  Confirm Bulk Update                │
│                                         │
│  Apply to 5 properties in              │
│  Downtown Properties?                  │
│                                         │
│  ⓘ Properties with inheritance         │
│     disabled will not be affected      │
│                                         │
│  [Cancel]  [Confirm Update]            │
└────────────────────────────────────────┘
```

**When**: Appears for "Group" or "All" scopes

**Always Check**:
- ✓ Property count is correct
- ✓ Group name is correct (for group scope)
- ✓ You intend this update

---

### Inheritance Status Card

```
┌────────────────────────────────────────┐
│ ℹ Settings Inheritance Active          │
│                                         │
│ Part of: Downtown Properties           │
│ Inheriting: 20 settings                │
│ Overrides: 2 settings                  │
│ Last synced: Jan 17, 2025 10:30 AM    │
│                                         │
│ [Disable Inheritance] [View Details]   │
└────────────────────────────────────────┘
```

**Where**: Top of settings pages when property is in a group

---

### Success Message

```
┌────────────────────────────────────────┐
│  ✓ Settings Applied Successfully       │
│                                         │
│  Updated: 5 properties                 │
│  Failed: 0 properties                  │
│  Duration: 3 seconds                   │
│                                         │
│  [View Details] [Close]                │
└────────────────────────────────────────┘
```

**When**: After successful bulk update

---

### Inheritance Indicators

**Inheriting**:
```
Check-in Time: 3:00 PM  ⓘ (blue icon)
Inherited from Downtown Properties
```

**Overridden**:
```
Check-in Time: 4:00 PM  ⚠ (orange icon)
Override Active (Group: 3:00 PM)
[Remove Override]
```

**Independent**:
```
Check-in Time: 3:00 PM
Property-specific setting
```

---

## All 28 Settings Pages

### Core Settings
1. ✓ Hotel Settings (check-in/out, currency, timezone)
2. ✓ Integration Settings (PMS, channel manager)
3. ✓ System Settings (security, backups)
4. ✓ Display Settings (language, formats)
5. ✓ Web Settings (website, booking engine)
6. ✓ Room Taxes (tax rates, rules)
7. ✓ POS Taxes (sales tax, GST)

### Operations
8. ✓ Room Type Management (room definitions)
9. ✓ Housekeeping Settings (cleaning workflows)
10. ✓ Booking Rules (cancellation, min stay)
11. ✓ Allotment Settings (inventory allocation)

### Financial & Marketing
12. ✓ Seasonal Pricing (rate plans, seasons)
13. ✓ Payment Methods (gateways, options)
14. ✓ Email Campaigns (marketing automation)
15. ✓ OTA Channels (distribution management)

### Templates
16. ✓ Message Templates (guest communications)
17. ✓ Notification Templates (system alerts)
18. ✓ Template Editor (rich text editor)
19. ✓ Template Management (template library)
20. ✓ Custom Fields (data collection)

### Configuration
21. ✓ Departments (org structure)
22. ✓ Hotel Areas (physical spaces)
23. ✓ Reason Codes (cancellation, discounts)
24. ✓ Salutations (guest titles)
25. ✓ Measurement Units (metric/imperial)
26. ✓ Phone Extensions (internal directory)
27. ✓ Revenue Accounts (GL mapping)
28. ✓ POS Attributes (product modifiers)

**All support the same 3-scope pattern!**

---

## Decision Tree: Which Scope?

```
START: Need to update a setting
    ↓
Does it apply to ALL properties?
    ├─ YES → Is it tested and verified?
    │        ├─ YES → Use "All My Properties"
    │        └─ NO → Test on "This Property Only" first
    └─ NO ↓

Does it apply to a GROUP of properties?
    ├─ YES → Are they in a property group?
    │        ├─ YES → Use "Property Group"
    │        └─ NO → Create group first, then use "Property Group"
    └─ NO ↓

Is it property-specific?
    └─ YES → Use "This Property Only"
```

---

## Common Scenarios

| Scenario | Scope | Example |
|----------|-------|---------|
| Testing new feature | Single | Test Stripe on 1 property |
| Regional tax update | Group | Update 5 downtown properties |
| Brand standard rollout | All | New logo across portfolio |
| Property-specific promo | Single | Beach resort summer deal |
| New payment gateway | All | Stripe for all properties |
| Local regulation compliance | Group | Regional tax changes |
| One-off adjustment | Single | Unique check-in time |

---

## Troubleshooting Quick Fixes

### Problem: "Property not in a group" error
**Fix**: Add property to a group via Portfolio Dashboard

---

### Problem: Settings not syncing to property
**Check**:
1. Is inheritance enabled? → Enable it
2. Is there an override? → Remove it if not needed
3. Is property in correct group? → Move if needed

---

### Problem: Can't save settings
**Check**:
1. Are required fields filled?
2. Are values valid (e.g., time format)?
3. Do you have permission?
4. Is network working?

---

### Problem: Wrong properties updated
**Prevention**:
- Always read confirmation dialog
- Verify property count
- Test on single property first

**Fix**:
- Manually revert incorrect properties
- Document previous values first

---

### Problem: Too many overrides
**Solution**:
- If >5 overrides: Consider different group
- Review necessity of each override
- Document reasons for keeping overrides

---

## Best Practices Checklist

**Before Bulk Update**:
- [ ] Test on single property (for critical changes)
- [ ] Document current settings
- [ ] Verify correct scope selected
- [ ] Count matches expectation
- [ ] Notify affected properties
- [ ] Schedule during low-traffic period

**During Update**:
- [ ] Read confirmation dialog carefully
- [ ] Verify affected property count
- [ ] Note any warnings
- [ ] Wait for completion message

**After Update**:
- [ ] Check success/error counts
- [ ] Verify on 2-3 sample properties
- [ ] Test critical user paths
- [ ] Monitor for 24 hours
- [ ] Document completion

---

## Time Estimates

| Task | Traditional | Multi-Property | Savings |
|------|------------|----------------|---------|
| Update 1 property | 2 min | 1 min | 50% |
| Update 10 properties | 20 min | 2 min | 90% |
| Update 50 properties | 100 min | 3 min | 97% |
| Create property group | N/A | 5 min | - |
| Manage overrides | Manual | 1 min | 95% |

---

## Important Notes

### ⚠️ Critical Warnings

1. **Tax Settings**: Always verify local regulations before bulk updates
2. **Payment Methods**: Test thoroughly before portfolio-wide rollout
3. **System Integrations**: Coordinate with IT/development teams
4. **Legal/Compliance**: Ensure bulk changes meet all requirements
5. **Confirmation Dialogs**: ALWAYS read before confirming

### ✅ Safety Tips

1. **Test First**: Use "This Property Only" for critical changes
2. **Read Confirmations**: Verify count and scope
3. **Monitor Results**: Check for errors after bulk updates
4. **Keep Backups**: Document settings before major changes
5. **Communicate**: Notify stakeholders of bulk updates

### 📊 When to Audit

- **Monthly**: Review properties with many overrides
- **Quarterly**: Check group structure effectiveness
- **Annually**: Major portfolio restructuring if needed
- **After Major Changes**: Verify all properties updated correctly

---

## Keyboard Shortcuts

Currently, multi-property features use standard mouse/touch interactions.

**Future Enhancement**: Keyboard shortcuts planned for v2.1
- `Alt + S` - Save settings
- `Alt + C` - Change scope
- `Alt + G` - Go to property group
- `Esc` - Cancel confirmation dialog

---

## Getting Help

**Documentation**:
- Full User Guide: `MULTI_PROPERTY_USER_GUIDE.md`
- Training Guide: `ADMIN_TRAINING_GUIDE.md`
- Developer Guide: `MULTI_PROPERTY_DEV_GUIDE.md`
- Release Notes: `MULTI_PROPERTY_RELEASE_NOTES.md`

**Support Channels**:
- Email: support@thepentouz.com
- Live Chat: Available in admin dashboard
- Phone: [Support Number]
- Community: community.thepentouz.com

**Training Resources**:
- Video Tutorials: See `VIDEO_SCRIPTS.md`
- Knowledge Base: help.thepentouz.com
- Webinars: Monthly admin training sessions

---

## Quick Stats

- **28 Settings Pages**: All support multi-property
- **3 Scopes**: Single, Group, All
- **Unlimited Groups**: Create as many as needed
- **Unlimited Properties**: Scale to any portfolio size
- **100% Pattern Consistency**: Same workflow everywhere
- **Zero Breaking Changes**: Existing features work as before

---

## Version Information

- **Current Version**: 2.0.0
- **Release Date**: January 2025
- **Last Updated**: January 2025
- **Compatibility**: All admin users with 2+ properties

---

**Print this page for quick desk reference!**

*Keep this guide handy while you work. For detailed instructions, see the full User Guide.*
