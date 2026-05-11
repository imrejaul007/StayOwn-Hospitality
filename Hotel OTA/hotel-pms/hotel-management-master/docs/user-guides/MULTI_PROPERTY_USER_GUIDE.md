# Multi-Property Settings Management - User Guide

**Version**: 2.0.0
**Last Updated**: January 2025
**For**: THE PENTOUZ Hotel Management System

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Understanding Multi-Property Settings](#understanding-multi-property-settings)
4. [Using the Three Scopes](#using-the-three-scopes)
5. [Understanding Inheritance](#understanding-inheritance)
6. [Common Workflows](#common-workflows)
7. [Settings Pages Reference](#settings-pages-reference)
8. [Troubleshooting](#troubleshooting)
9. [Frequently Asked Questions](#frequently-asked-questions)

---

## Introduction

### What is Multi-Property Management?

Multi-property management allows you to manage multiple hotel properties from a single interface. Instead of configuring each property individually, you can:

- **Apply settings to a single property** - Traditional one-at-a-time configuration
- **Apply settings to a property group** - Manage related properties together
- **Apply settings to all properties** - Standardize across your entire portfolio

### Why Use Multi-Property Management?

**Time Savings**
- Configure 10 properties in seconds instead of hours
- No need to log in and out of different property accounts
- Bulk updates eliminate repetitive tasks

**Consistency**
- Ensure standardized policies across properties
- Reduce configuration errors and discrepancies
- Maintain brand standards effortlessly

**Flexibility**
- Choose the right scope for each update
- Allow property-specific overrides when needed
- Group related properties for easier management

**Scalability**
- Easily add new properties to your portfolio
- Manage 2 properties or 200 with the same interface
- Enterprise-ready architecture

---

## Getting Started

### Prerequisites

Before using multi-property features, ensure you have:

1. **Multiple Properties**: At least 2 properties in your account
2. **Admin Access**: Multi-property settings require admin privileges
3. **Property Groups** (optional): Create groups for related properties

### Setting Up Property Groups

Property groups help you organize related properties for easier bulk management.

**Step 1: Navigate to Portfolio Dashboard**
```
Admin Menu → Portfolio Dashboard
```

**Step 2: Create a New Group**
1. Click **"Create Property Group"** button
2. Enter group details:
   - **Name**: e.g., "Downtown Properties"
   - **Description**: e.g., "All properties in downtown area"
   - **Group Type**: Chain, Franchise, Management Company, or Independent
3. Click **"Create Group"**

**Step 3: Add Properties to the Group**
1. Open the group you created
2. Click **"Add Properties"** button
3. Select properties from the list
4. Click **"Add Selected"**

**Step 4: Configure Group Settings (Optional)**
- Set base currency for the group
- Configure timezone
- Set default language

[Screenshot Placeholder: Portfolio Dashboard with property groups]

---

## Understanding Multi-Property Settings

### The ApplyTo Selector

Every settings page now includes an **"Apply Settings To"** selector with three options:

```
┌─────────────────────────────────────────┐
│ ⓘ Apply Settings To                     │
├─────────────────────────────────────────┤
│                                          │
│ ○ This Property Only                    │
│   Grand Hotel Downtown                   │
│                                          │
│ ○ Property Group                         │
│   Downtown Properties (5 properties)     │
│                                          │
│ ○ All My Properties                      │
│   All 12 properties you own             │
│                                          │
└─────────────────────────────────────────┘
```

[Screenshot Placeholder: ApplyTo Selector UI component]

### How It Works

1. **Make your changes** - Configure settings as usual
2. **Choose scope** - Select where to apply changes
3. **Review confirmation** - See how many properties will be affected
4. **Confirm update** - Apply changes to selected properties
5. **View results** - See success/error messages with property counts

---

## Using the Three Scopes

### Scope 1: This Property Only

**When to use:**
- Property-specific configurations
- Testing changes before wider rollout
- Properties with unique requirements
- One-off adjustments

**How it works:**
- Changes apply only to the currently selected property
- No confirmation dialog (traditional behavior)
- Other properties are not affected
- Can override group settings

**Example:**
```
Scenario: Your beach resort needs later check-in due to sunset views
Action: Select "This Property Only"
Result: Only Beach Resort gets 4pm check-in; others keep 3pm
```

### Scope 2: Property Group

**When to use:**
- Related properties share common characteristics
- Regional standardization needed
- Brand consistency within a segment
- Franchisee or management group updates

**How it works:**
- Changes apply to all properties in the same group
- Requires confirmation dialog
- Shows exact number of affected properties
- Properties can still override if inheritance allows

**Example:**
```
Scenario: All downtown properties should have the same cancellation policy
Action: Select "Property Group" → Downtown Properties
Result: All 5 downtown properties get the new policy
Affected: Grand Hotel Downtown, City Center Inn, Metro Suites, Urban Lodge, Downtown Express
```

[Screenshot Placeholder: Property Group scope with affected properties list]

### Scope 3: All My Properties

**When to use:**
- Portfolio-wide standardization
- Company policy changes
- Brand guidelines updates
- New features or services rollout

**How it works:**
- Changes apply to every property in your account
- Requires confirmation dialog with total count
- Highest impact - use carefully
- Individual properties can still override

**Example:**
```
Scenario: New company-wide payment gateway integration
Action: Select "All My Properties"
Result: All 12 properties get the new Stripe configuration
Note: Verify all properties are compatible first
```

### Choosing the Right Scope

| Situation | Recommended Scope | Reason |
|-----------|------------------|---------|
| Testing new settings | This Property Only | Safe, isolated testing |
| Regional policy update | Property Group | Affects related properties |
| Brand standard rollout | All My Properties | Ensures consistency |
| Property-specific promo | This Property Only | Unique to one location |
| Seasonal pricing template | Property Group | Region-based pricing |
| System-wide integration | All My Properties | Needs universal deployment |

---

## Understanding Inheritance

### What is Settings Inheritance?

Inheritance allows a property to automatically receive settings updates from its property group. When inheritance is enabled:

- Property uses group's settings by default
- Updates to the group automatically apply to the property
- Property can still create overrides when needed
- Reduces manual configuration work

### Visual Guide to Inheritance

**Inheritance Enabled:**
```
Property Group (Parent)
    ├── Check-in Time: 3:00 PM
    ├── Check-out Time: 11:00 AM
    └── Cancellation Policy: Flexible
            ↓ (inherited by)
Downtown Hotel (Child)
    ├── Check-in Time: 3:00 PM ← inherited
    ├── Check-out Time: 11:00 AM ← inherited
    └── Cancellation Policy: Flexible ← inherited
```

**With Override:**
```
Property Group (Parent)
    ├── Check-in Time: 3:00 PM
    ├── Check-out Time: 11:00 AM
    └── Cancellation Policy: Flexible
            ↓ (partially inherited)
Beach Resort (Child)
    ├── Check-in Time: 4:00 PM ← OVERRIDE
    ├── Check-out Time: 11:00 AM ← inherited
    └── Cancellation Policy: Flexible ← inherited
```

### Inheritance Status Card

When a property inherits settings, you'll see a status card:

```
┌────────────────────────────────────────────────┐
│ ℹ Settings Inheritance Active                  │
├────────────────────────────────────────────────┤
│ This property is part of Downtown Properties   │
│ and inherits the following settings:           │
│                                                 │
│ • Check-in/Check-out times                     │
│ • Room tax configuration                       │
│ • Payment methods                              │
│ • Email templates                              │
│                                                 │
│ Last synced: Jan 17, 2025 at 10:30 AM         │
│ by Admin User                                  │
│                                                 │
│ [Disable Inheritance] [Override Settings]      │
└────────────────────────────────────────────────┘
```

[Screenshot Placeholder: Inheritance status card]

### Enabling/Disabling Inheritance

**To Enable Inheritance:**
1. Ensure property is in a group
2. Navigate to any settings page
3. Look for inheritance status card
4. Click **"Enable Inheritance"**
5. Confirm the action

**To Disable Inheritance:**
1. Click **"Disable Inheritance"** on status card
2. Confirm you want to manage settings independently
3. Property settings become independent
4. No longer receives group updates automatically

### Creating Overrides

Overrides let you customize specific settings while still inheriting others.

**How to Create an Override:**
1. Select **"This Property Only"** scope
2. Make your changes
3. Save - this creates an override
4. Other settings continue to inherit

**Override Example:**
```
Beach Resort needs 4pm check-in but keeps all other group settings
Action: Select "This Property Only" → Update check-in time → Save
Result: Check-in time is overridden; all other settings still inherit
```

**To Remove an Override:**
1. Navigate to the overridden setting
2. Click **"Restore to Group Setting"**
3. Confirm - override is removed
4. Property returns to inheriting this setting

---

## Common Workflows

### Workflow 1: Setting Up a New Property Group

**Objective**: Create a group for airport properties

**Steps:**
1. Go to **Admin → Portfolio Dashboard**
2. Click **"Create Property Group"**
3. Fill in details:
   - Name: "Airport Properties"
   - Description: "All properties near major airports"
   - Type: Chain
4. Click **"Create Group"**
5. Add properties:
   - Select: Airport Inn, Terminal Hotel, Skyway Suites
   - Click **"Add Selected"**
6. Configure base settings:
   - Currency: USD
   - Timezone: America/New_York
   - Check-in: 3:00 PM
   - Check-out: 11:00 AM
7. Click **"Save Group Settings"**

**Result**: Group created with 3 properties ready for bulk management

---

### Workflow 2: Standardizing Settings Across Properties

**Objective**: Update check-in/check-out times for all downtown properties

**Steps:**
1. Select any downtown property
2. Go to **Admin → Settings → Hotel Settings**
3. Scroll to "Check-in/Check-out Times" section
4. Update times:
   - Check-in: 3:00 PM
   - Check-out: 11:00 AM
5. In **"Apply Settings To"** selector, choose **"Property Group"**
6. Click **"Save Settings"**
7. Review confirmation dialog:
   - "Apply to 5 properties in Downtown Properties?"
   - See affected properties list
8. Click **"Confirm Update"**
9. Wait for success message:
   - "Settings applied to 5 properties"

**Result**: All 5 downtown properties now have standardized check-in/out times

[Screenshot Placeholder: Bulk update confirmation dialog]

---

### Workflow 3: Creating Property-Specific Overrides

**Objective**: Beach resort needs later check-in but keeps other group settings

**Steps:**
1. Select Beach Resort property
2. Go to **Admin → Settings → Hotel Settings**
3. Note the inheritance status card showing current settings
4. In **"Apply Settings To"** selector, choose **"This Property Only"**
5. Update check-in time: 4:00 PM (sunset viewing)
6. Keep check-out time: 11:00 AM (inherited)
7. Click **"Save Settings"**
8. No confirmation needed (single property)
9. See success message with override indicator

**Result**: Beach Resort has 4pm check-in (override), keeps 11am check-out (inherited)

---

### Workflow 4: Bulk Updating All Properties

**Objective**: Add new payment method (Stripe) to all properties

**Steps:**
1. Select any property
2. Go to **Admin → Settings → Payment Methods**
3. Click **"Add Payment Method"**
4. Configure Stripe settings:
   - Name: Stripe Payments
   - Type: Credit Card
   - Gateway: Stripe
   - API Keys: [enter keys]
5. In **"Apply Settings To"** selector, choose **"All My Properties"**
6. Click **"Save Settings"**
7. Review confirmation dialog:
   - "Apply to all 12 of your properties?"
   - Warning about bulk update impact
8. Verify all properties are compatible
9. Click **"Confirm Update"**
10. Wait for completion (may take 10-30 seconds)
11. Review results:
    - "Settings applied to 12 properties"
    - 0 properties failed

**Result**: All 12 properties now have Stripe payment method configured

---

### Workflow 5: Testing Before Rollout

**Objective**: Test new seasonal pricing before applying to all properties

**Steps:**
1. Select a test property (e.g., "Demo Hotel")
2. Go to **Admin → Settings → Seasonal Pricing**
3. Create new season:
   - Name: Summer 2025
   - Dates: June 1 - August 31
   - Rate Modifier: +25%
4. In **"Apply Settings To"** selector, choose **"This Property Only"**
5. Click **"Save Settings"**
6. Test the pricing:
   - Create sample bookings
   - Verify rates are calculated correctly
   - Check all room types
7. Once verified, apply to property group:
   - Select **"Property Group"** scope
   - Click **"Save Settings"**
   - Confirm bulk update
8. Monitor results and guest feedback
9. If successful, consider applying to all properties

**Result**: Safe, gradual rollout with testing before wide deployment

---

## Settings Pages Reference

All 28 settings pages support multi-property management. Here's a comprehensive reference:

### Core Settings (7 pages)

#### 1. Hotel Settings
**Path**: Admin → Settings → Hotel Settings
**What it controls**: Check-in/out times, currency, timezone, operational hours
**Common use cases**:
- Standardize check-in/out across property group
- Update currency for regional properties
- Adjust timezone for new acquisitions

**Scopes typically used**: Group (regional consistency), All (brand standards)

---

#### 2. Integration Settings
**Path**: Admin → Settings → Integration Settings
**What it controls**: Third-party integrations (PMS, channel manager, payment gateways)
**Common use cases**:
- Roll out new PMS integration to all properties
- Configure regional OTA connections
- Update API credentials portfolio-wide

**Scopes typically used**: All (system-wide integrations), Group (regional partners)

---

#### 3. System Settings
**Path**: Admin → Settings → System Settings
**What it controls**: System-wide configurations, security settings, notification preferences
**Common use cases**:
- Enable new features across portfolio
- Update security policies company-wide
- Configure backup schedules

**Scopes typically used**: All (security & compliance), Single (testing)

---

#### 4. Display Settings
**Path**: Admin → Settings → Display Settings
**What it controls**: UI preferences, language settings, date/time formats
**Common use cases**:
- Standardize date formats across properties
- Set regional language preferences
- Configure display units (metric vs imperial)

**Scopes typically used**: Group (regional preferences), Single (property-specific)

---

#### 5. Web Settings
**Path**: Admin → Settings → Web Settings
**What it controls**: Website configuration, booking engine, online presence
**Common use cases**:
- Update booking engine settings portfolio-wide
- Configure SEO settings by region
- Enable/disable online booking features

**Scopes typically used**: All (brand consistency), Group (regional marketing)

**Sections** (8 total):
- General settings
- Booking engine configuration
- SEO & metadata
- Social media links
- Contact information
- Terms & conditions
- Privacy policy
- Cookie settings

---

#### 6. Room Taxes
**Path**: Admin → Settings → Room Taxes
**What it controls**: Tax rates, tax types, tax calculation rules
**Common use cases**:
- Update tax rates after legislation changes
- Configure regional tax rules
- Add new tax types (city tax, tourism tax)

**Scopes typically used**: Group (regional taxes), Single (local taxes)

**Important**: Always verify local tax regulations before bulk updates

---

#### 7. POS Taxes
**Path**: Admin → Settings → POS Taxes
**What it controls**: Point of sale tax configuration, sales tax, GST/VAT
**Common use cases**:
- Update GST/VAT rates
- Configure tax exemptions
- Add service charges

**Scopes typically used**: Group (regional), Single (local regulations)

---

### Operations & Management (4 pages)

#### 8. Room Type Management
**Path**: Admin → Inventory → Room Types
**What it controls**: Room type definitions, amenities, capacity, pricing
**Common use cases**:
- Standardize room type names across properties
- Update amenities lists portfolio-wide
- Configure base pricing structures

**Scopes typically used**: Group (brand consistency), Single (unique rooms)

---

#### 9. Housekeeping Settings
**Path**: Admin → Operations → Housekeeping
**What it controls**: Cleaning schedules, task templates, inspection checklists
**Common use cases**:
- Standardize cleaning procedures
- Update inspection checklists company-wide
- Configure task assignment rules

**Scopes typically used**: All (quality standards), Group (regional workflows)

---

#### 10. Booking Rules
**Path**: Admin → Settings → Booking Rules
**What it controls**: Cancellation policies, minimum stay, advance booking rules
**Common use cases**:
- Update cancellation policies seasonally
- Configure minimum stay requirements
- Set advance booking windows

**Scopes typically used**: Group (regional policies), All (brand standards)

---

#### 11. Allotment Global Settings
**Path**: Admin → Allotments → Global Settings
**What it controls**: Default allotment rules, release periods, inventory allocation
**Common use cases**:
- Standardize allotment release periods
- Configure default allocation rules
- Update corporate allotment settings

**Scopes typically used**: Group (corporate accounts), All (company policies)

---

### Financial & Marketing (4 pages)

#### 12. Seasonal Pricing
**Path**: Admin → Revenue → Seasonal Pricing
**What it controls**: Seasonal rate plans, pricing periods, rate modifiers
**Common use cases**:
- Create seasonal pricing templates
- Configure regional high/low seasons
- Apply rate modifiers across properties

**Scopes typically used**: Group (regional seasonality), Single (local events)

---

#### 13. Payment Methods
**Path**: Admin → Settings → Payment Methods
**What it controls**: Payment gateway configurations, accepted payment types
**Common use cases**:
- Add new payment gateways portfolio-wide
- Configure regional payment options
- Update payment processor credentials

**Scopes typically used**: All (company-wide), Group (regional gateways)

---

#### 14. Email Campaigns
**Path**: Admin → Marketing → Email Campaigns
**What it controls**: Email campaign templates, automation rules, lists
**Common use cases**:
- Deploy marketing campaigns to property groups
- Create regional promotional templates
- Configure automated email sequences

**Scopes typically used**: Group (regional campaigns), Single (property events)

---

#### 15. OTA Channel Manager
**Path**: Admin → Distribution → OTA Channels
**What it controls**: OTA configurations, channel settings, rate parity
**Common use cases**:
- Configure OTA connections for new properties
- Update channel settings regionally
- Manage rate parity rules

**Scopes typically used**: Group (regional OTAs), All (major platforms)

---

### Templates & Communication (5 pages)

#### 16. Message Templates
**Path**: Admin → Communications → Message Templates
**What it controls**: Guest message templates, automated communications
**Common use cases**:
- Standardize guest communication templates
- Update confirmation email templates
- Configure automated messages

**Scopes typically used**: All (brand consistency), Group (regional language)

---

#### 17. Notification Templates
**Path**: Admin → Notifications → Templates
**What it controls**: System notification templates, alert configurations
**Common use cases**:
- Update notification formats
- Configure alert thresholds
- Standardize notification preferences

**Scopes typically used**: All (system-wide), Group (regional teams)

---

#### 18. Template Editor
**Path**: Admin → Notifications → Template Editor
**What it controls**: Rich text email templates, custom designs
**Common use cases**:
- Create branded email templates
- Update template designs
- Configure dynamic content

**Scopes typically used**: All (brand templates), Group (regional branding)

---

#### 19. Template Management
**Path**: Admin → Notifications → Manage Templates
**What it controls**: Template library, versioning, approval workflows
**Common use cases**:
- Organize template library
- Deploy approved templates
- Manage template versions

**Scopes typically used**: All (library management), Group (regional approvals)

---

#### 20. Custom Fields
**Path**: Admin → Settings → Custom Fields
**What it controls**: Custom field definitions for guests, bookings, properties
**Common use cases**:
- Add custom guest data fields
- Configure booking custom fields
- Standardize data collection

**Scopes typically used**: All (data consistency), Group (regional requirements)

---

### Configuration & Structure (10 pages)

#### 21. Departments
**Path**: Admin → Settings → Departments
**What it controls**: Department definitions, hierarchies, responsibilities
**Common use cases**:
- Standardize department structure
- Configure reporting hierarchies
- Define role responsibilities

**Scopes typically used**: All (org structure), Group (regional variations)

---

#### 22. Hotel Areas
**Path**: Admin → Settings → Hotel Areas
**What it controls**: Physical area definitions (lobby, pool, restaurant, etc.)
**Common use cases**:
- Standardize area naming
- Configure area-specific settings
- Define maintenance zones

**Scopes typically used**: Group (similar properties), Single (unique layouts)

---

#### 23. Reason Codes
**Path**: Admin → Settings → Reasons
**What it controls**: Cancellation reasons, discount reasons, adjustment codes
**Common use cases**:
- Standardize reason code lists
- Add new codes company-wide
- Configure reporting categories

**Scopes typically used**: All (consistency), Group (regional codes)

---

#### 24. Salutations
**Path**: Admin → Settings → Salutations
**What it controls**: Guest salutation options (Mr., Mrs., Dr., etc.)
**Common use cases**:
- Configure regional salutation preferences
- Add culturally appropriate options
- Standardize guest data

**Scopes typically used**: Group (cultural regions), All (baseline options)

---

#### 25. Measurement Units
**Path**: Admin → Settings → Measurement Units
**What it controls**: Units for temperature, distance, weight, volume
**Common use cases**:
- Configure regional unit preferences (metric vs imperial)
- Standardize reporting units
- Update display formats

**Scopes typically used**: Group (regional), All (company standard)

---

#### 26. Phone Extensions
**Path**: Admin → Settings → Phone Extensions
**What it controls**: Internal phone system configuration, extensions, directories
**Common use cases**:
- Configure phone system for new properties
- Update extension directories
- Standardize phone routing

**Scopes typically used**: Single (property-specific), Group (centralized systems)

---

#### 27. Revenue Accounts
**Path**: Admin → Finance → Revenue Accounts
**What it controls**: Revenue account mapping, accounting codes, GL integration
**Common use cases**:
- Configure accounting system integration
- Standardize revenue categories
- Update GL account mapping

**Scopes typically used**: All (accounting consistency), Group (regional accounting)

---

#### 28. POS Attributes
**Path**: Admin → POS → Attributes
**What it controls**: Point of sale item attributes, modifiers, options
**Common use cases**:
- Standardize menu item attributes
- Configure POS modifiers
- Update product options

**Scopes typically used**: Group (regional menus), All (brand items)

---

## Troubleshooting

### Common Issues

#### Issue 1: "Property not in a group" Error

**Symptoms**: Cannot select "Property Group" scope

**Cause**: The current property is not assigned to any property group

**Solution**:
1. Go to Portfolio Dashboard
2. Create a property group OR
3. Add the property to an existing group
4. Return to settings page
5. Refresh - "Property Group" option now available

---

#### Issue 2: Settings Not Syncing to Properties

**Symptoms**: Changes applied but some properties don't update

**Possible Causes & Solutions**:

**Cause A: Inheritance Disabled**
- Check: Properties may have inheritance disabled
- Solution: Enable inheritance on affected properties

**Cause B: Override Active**
- Check: Properties may have property-specific overrides
- Solution: Remove overrides if you want group settings to apply

**Cause C: Network Error**
- Check: Connection issues during bulk update
- Solution: Check network, retry the update

**Cause D: Permission Issues**
- Check: User may not have permission for all properties
- Solution: Verify admin access to all properties

---

#### Issue 3: Cannot Save Changes

**Symptoms**: "Save" button disabled or errors on save

**Possible Causes & Solutions**:

**Cause A: Validation Errors**
- Check: Form fields may have invalid values
- Solution: Review error messages, correct invalid fields

**Cause B: Required Fields Missing**
- Check: Required fields may be empty
- Solution: Fill in all required fields (marked with *)

**Cause C: Network Timeout**
- Check: Large bulk updates may timeout
- Solution: Try smaller batches or contact support

---

#### Issue 4: Confirmation Dialog Doesn't Appear

**Symptoms**: Expected confirmation dialog doesn't show

**Cause**: Scope is set to "This Property Only"

**Solution**:
- Confirmation only shows for "Group" or "All" scopes
- This is expected behavior for single property updates
- If you want confirmation, use "Group" or "All" scope

---

#### Issue 5: Affected Properties Count Wrong

**Symptoms**: Confirmation shows different count than expected

**Possible Causes & Solutions**:

**Cause A: Properties Added/Removed from Group**
- Check: Group membership may have changed
- Solution: Verify current group membership in Portfolio Dashboard

**Cause B: Inheritance Settings Changed**
- Check: Some properties may have disabled inheritance
- Solution: Count only includes properties with inheritance enabled

**Cause C: Permission Changes**
- Check: User access may have changed
- Solution: Count only includes properties you can manage

---

#### Issue 6: "Something went wrong" Error

**Symptoms**: Generic error message on update

**Steps to Resolve**:
1. Check your internet connection
2. Refresh the page and try again
3. Verify you're still logged in (session may have expired)
4. Check if the property/group still exists
5. Try with a smaller scope (single property) first
6. If issue persists, contact support with:
   - Property IDs affected
   - Setting type being updated
   - Exact error message (check browser console)

---

### Getting Help

**Check System Status**
1. Go to Settings → System Information
2. Verify all services are operational
3. Check for scheduled maintenance

**Contact Support**
- Email: support@thepentouz.com
- Phone: [Support Number]
- Live Chat: Available in admin dashboard
- Include: Property ID, setting type, error details

**Community Resources**
- User Forum: community.thepentouz.com
- Knowledge Base: help.thepentouz.com
- Video Tutorials: youtube.com/thepentouz

---

## Frequently Asked Questions

### General Questions

**Q1: Do I need property groups to use multi-property features?**

A: No, you can still use "All My Properties" scope without groups. However, groups make it easier to organize and manage related properties.

---

**Q2: Can I undo a bulk update?**

A: Currently, bulk updates cannot be undone automatically. However, you can:
- Revert to previous settings manually
- Use single property scope to fix affected properties
- Contact support for assistance with large-scale reverts

---

**Q3: How long does a bulk update take?**

A: Update times vary by scope:
- Single property: Instant (< 1 second)
- Property group (5-10 properties): 2-5 seconds
- All properties (10-50 properties): 5-30 seconds
- Large portfolios (50+ properties): 30-60 seconds

You'll see a progress indicator during the update.

---

**Q4: Will bulk updates affect properties I don't manage?**

A: No, bulk updates only affect properties where you have admin access. The system automatically filters to properties you can manage.

---

**Q5: Can guests or staff see multi-property settings?**

A: No, multi-property features are admin-only. Guests and staff see only their relevant property's settings.

---

### Property Groups

**Q6: How many properties can be in a group?**

A: No limit. Groups can have 2 to 1000+ properties.

---

**Q7: Can a property belong to multiple groups?**

A: No, each property can only belong to one property group at a time. This prevents conflicting inheritance rules.

---

**Q8: What happens if I delete a property group?**

A: When you delete a group:
- Properties are unlinked but NOT deleted
- Properties become standalone (no inheritance)
- Existing settings on properties remain unchanged
- You can add properties to other groups later

---

**Q9: Can I move a property from one group to another?**

A: Yes:
1. Remove property from current group
2. Add property to new group
3. Property will start inheriting from new group
4. Previous overrides are preserved

---

### Inheritance & Overrides

**Q10: What happens to my property settings when I join a group?**

A: When joining a group:
- Your current settings are preserved as overrides
- You can choose which settings to inherit
- Enable inheritance to adopt group settings
- Keep overrides to maintain property-specific settings

---

**Q11: Can I inherit some settings but not others?**

A: Yes, inheritance works per setting type. You can:
- Inherit check-in/out times from group
- Override seasonal pricing locally
- Inherit tax settings from group
- Keep custom payment methods

Each setting type can be independently configured.

---

**Q12: How do I know which settings are inherited vs overridden?**

A: Look for visual indicators:
- **Inherited**: Blue "i" icon, "Inherited from [Group Name]" label
- **Overridden**: Orange "!" icon, "Property Override Active" label
- Inheritance status card shows complete list

---

**Q13: Will enabling inheritance replace my current settings?**

A: Yes, with confirmation:
1. System shows what will change
2. You confirm the action
3. Current settings are replaced with group settings
4. Previous settings are not stored (cannot undo)

Best practice: Review group settings before enabling inheritance.

---

### Safety & Permissions

**Q14: Is there a way to test bulk updates before applying?**

A: Yes, recommended workflow:
1. Test on a single property first ("This Property Only")
2. If successful, apply to a small group
3. Verify results before portfolio-wide rollout
4. Use staging/test properties when available

---

**Q15: Can I prevent accidental bulk updates?**

A: The system has built-in safeguards:
- Confirmation dialogs for bulk updates
- Shows exact property count before applying
- Warning messages for high-impact changes
- Scope defaults to "This Property Only" (safest option)

---

**Q16: Who can see/use multi-property features?**

A: Only users with:
- Admin role AND
- Access to 2+ properties

Staff and guests don't see these features.

---

**Q17: Can I limit which admins can do bulk updates?**

A: Yes, through permission settings:
1. Go to Settings → Role Permissions
2. Edit Admin role
3. Configure multi-property permissions:
   - Allow bulk updates: Yes/No
   - Restrict to property groups: Yes/No
   - Require approval: Yes/No

---

### Technical Questions

**Q18: Do multi-property updates happen in real-time?**

A: Yes, updates are applied immediately:
- Single property: Instant
- Bulk updates: Sequential (one at a time)
- You see real-time progress
- Results show success/failure for each property

---

**Q19: What happens if an update fails on some properties?**

A: The system continues updating other properties:
- Successful updates are applied
- Failed updates are logged
- You see a summary: "10 succeeded, 2 failed"
- Error details provided for failed properties
- No automatic rollback (successful updates remain)

---

**Q20: Can I schedule bulk updates for later?**

A: Not currently. All updates apply immediately. However, you can:
- Use API for scheduled updates (developer feature)
- Contact support for scheduled maintenance windows
- Update during low-traffic hours manually

Scheduled updates are planned for future release.

---

### Best Practices

**Q21: What's the best way to manage a large portfolio?**

A: Recommended structure:
1. Create property groups by:
   - Region (East Coast, West Coast)
   - Type (Budget, Luxury, Business)
   - Brand (Brand A, Brand B)
2. Set base settings at group level
3. Allow property-specific overrides
4. Regular audits to ensure consistency
5. Use staging properties for testing

---

**Q22: Should I always use bulk updates?**

A: No, choose the appropriate scope:
- Use "Single" for: Testing, unique properties, one-off changes
- Use "Group" for: Regional updates, related properties
- Use "All" for: Brand standards, system-wide changes

More targeted updates are safer and easier to troubleshoot.

---

**Q23: How often should I review inherited vs overridden settings?**

A: Recommended schedule:
- Monthly: Review properties with many overrides
- Quarterly: Audit group vs property settings
- Annually: Restructure groups if needed
- After bulk updates: Verify results within 24 hours

High override counts may indicate group structure needs adjustment.

---

**Q24: What settings should I standardize vs customize?**

A: General guidelines:

**Standardize (use groups/all):**
- Brand policies (cancellation, check-in times)
- Payment methods
- System integrations
- Security settings
- Accounting structure
- Message templates

**Customize (use single/overrides):**
- Seasonal pricing (local market)
- Local taxes
- Property-specific amenities
- Regional promotions
- Phone extensions
- Hotel area definitions

---

### Migration & Setup

**Q25: I'm new to multi-property. Where do I start?**

A: Step-by-step onboarding:

**Week 1: Setup**
1. Create property groups
2. Assign properties to groups
3. Review current settings across properties

**Week 2: Testing**
1. Test single property updates
2. Test small group updates (2-3 properties)
3. Verify inheritance behavior

**Week 3: Standardization**
1. Identify settings to standardize
2. Apply group settings gradually
3. Allow properties to override as needed

**Week 4: Optimization**
1. Review override counts
2. Adjust group structure
3. Train team on features
4. Establish workflows

---

**Q26: Can I migrate existing settings to group settings?**

A: Yes, process:
1. Select a "template" property with desired settings
2. Create property group
3. Add properties to group
4. Use "Property Group" scope on template property
5. Apply settings to group
6. Other properties inherit these settings

Alternative: Set group settings manually, then add properties.

---

---

## Summary

Multi-property settings management transforms how you manage hotel portfolios:

**Key Benefits:**
- Save hours with bulk updates
- Ensure brand consistency
- Maintain flexibility for property-specific needs
- Scale effortlessly as you grow

**Three Scopes:**
- Single: One property
- Group: Related properties
- All: Entire portfolio

**Inheritance:**
- Automatic sync from group to property
- Override when needed
- Visual indicators

**28 Settings Pages:**
- All support multi-property
- Consistent interface
- Comprehensive coverage

**Next Steps:**
1. Create your first property group
2. Test with single property updates
3. Graduate to group updates
4. Roll out portfolio-wide standards
5. Train your team

For additional help, consult the Quick Reference Guide or contact support.

---

**Document Version**: 1.0
**Last Updated**: January 2025
**Questions?** Contact support@thepentouz.com
