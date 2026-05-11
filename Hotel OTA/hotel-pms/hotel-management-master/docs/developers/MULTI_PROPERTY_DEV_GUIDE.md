# Multi-Property Settings Management - Developer Guide

**Version**: 2.0.0
**Last Updated**: January 2025
**For**: THE PENTOUZ Hotel Management System Developers

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Frontend Integration](#frontend-integration)
3. [Backend Integration](#backend-integration)
4. [API Reference](#api-reference)
5. [Database Schema](#database-schema)
6. [Testing Guide](#testing-guide)
7. [Code Examples](#code-examples)
8. [Troubleshooting](#troubleshooting)
9. [Performance Optimization](#performance-optimization)
10. [Security Considerations](#security-considerations)

---

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + TypeScript)             │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ Admin Pages    │→│ React Hooks     │→│ API Client   │ │
│  │ (28 pages)     │  │ (useSettings-   │  │ (axios)      │ │
│  │                │  │  Inheritance)   │  │              │ │
│  └────────────────┘  └─────────────────┘  └──────────────┘ │
└───────────────────────────────────┬─────────────────────────┘
                                    │ REST API (JSON)
┌───────────────────────────────────▼─────────────────────────┐
│                    Backend (Node.js + Express)               │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ API Routes     │→│ Services        │→│ Database     │ │
│  │ (/settings/*)  │  │ (Settings       │  │ (MongoDB)    │ │
│  │                │  │  Inheritance)   │  │              │ │
│  └────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

**Single Property Update**:
```
User Action → Component Handler → API Call → Direct DB Update → Response
```

**Property Group Update**:
```
User Action → Component Handler → Confirmation Dialog
     → User Confirms → API Call → Settings Service
     → Iterate Properties → Update Each → Track Results
     → Return Summary → UI Feedback
```

**Settings Inheritance**:
```
Group Setting Changed → Service Detects Inheriting Properties
     → Queue Updates → Sequential Apply → Update Inheritance Records
     → Return Results
```

### Key Components

**Frontend**:
- `ApplyToSelector.tsx` - Scope selection UI component
- `ApplyToConfirmation.tsx` - Bulk update confirmation dialog
- `useSettingsInheritance.ts` - React hook for multi-property operations
- `PropertyContext.tsx` - Property selection context
- `usePortfolio.ts` - Portfolio and group management hook

**Backend**:
- `settingsInheritance.js` - Core service for multi-property logic
- `/routes/settings/*` - API endpoints for settings operations
- `/routes/portfolio.js` - Property group management endpoints
- `propertyAccess.js` - Middleware for access validation

**Database**:
- `PropertyGroups` - Property group definitions
- `SettingsInheritance` - Inheritance tracking per property
- `Hotels` - Enhanced with group membership fields

---

## Frontend Integration

### Adding Multi-Property Support to a Page

Follow this 6-step pattern to add multi-property support to any settings page:

#### Step 1: Import Dependencies

```typescript
import React, { useState } from 'react';
import { ApplyToSelector, ApplyToConfirmation, ApplyToScope } from '@/components/settings/ApplyToSelector';
import { useSettingsInheritance, useAffectedPropertiesCount } from '@/hooks/useSettingsInheritance';
import { useProperty } from '@/context/PropertyContext';
```

#### Step 2: Setup State and Hooks

```typescript
function YourSettingsPage() {
  const { selectedPropertyId, selectedProperty } = useProperty();

  // ApplyTo scope state (defaults to 'single')
  const [applyToScope, setApplyToScope] = useState<ApplyToScope>('single');

  // Success/error state for feedback
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Multi-property hook
  const {
    useInheritanceStatus,
    applySettings,
    isUpdating,
    updateError,
    showConfirmation,
    pendingUpdate,
    confirmBulkUpdate,
    cancelBulkUpdate,
  } = useSettingsInheritance();

  // Get inheritance status for current property
  const inheritanceStatus = useInheritanceStatus(selectedPropertyId);

  // Calculate affected properties count
  const affectedCount = useAffectedPropertiesCount(
    applyToScope,
    inheritanceStatus.data?.groupPropertyCount
  );

  // ... rest of component
}
```

#### Step 3: Update Save Handler

```typescript
const handleSave = async (formData: YourFormData) => {
  try {
    // Check if bulk update (group or all scope)
    if (applyToScope !== 'single') {
      // Use multi-property service
      const result = await applySettings({
        scope: applyToScope,
        propertyId: selectedPropertyId,
        settingUpdates: formData,
        settingType: 'your_setting_type', // e.g., 'booking_rules', 'room_taxes', etc.
      });

      // If null, user cancelled or error occurred
      if (!result) return;

      // Show success with property count
      setSuccessMessage(
        `Settings applied to ${result.propertiesUpdated} ${
          result.propertiesUpdated === 1 ? 'property' : 'properties'
        }`
      );
      setShowSuccess(true);

    } else {
      // Single property - use existing logic
      const response = await api.put(`/your-endpoint/${selectedPropertyId}`, formData);

      setSuccessMessage('Settings updated successfully');
      setShowSuccess(true);
    }
  } catch (error) {
    console.error('Error saving settings:', error);
    // Error handling
  }
};
```

#### Step 4: Add ApplyTo Selector to JSX

```tsx
return (
  <div className="settings-page">
    {/* Header, navigation, etc. */}

    {/* ApplyTo Selector - appears only for multi-property users */}
    <ApplyToSelector
      value={applyToScope}
      onChange={setApplyToScope}
      isInGroup={inheritanceStatus.data?.hasGroup || false}
      groupName={inheritanceStatus.data?.groupName}
      totalProperties={inheritanceStatus.data?.groupPropertyCount || 0}
      showWarning={true}
      warningMessage="This will update settings for multiple properties. Verify all properties should have these settings."
    />

    {/* Inheritance Status Card (optional but recommended) */}
    {inheritanceStatus.data?.hasGroup && inheritanceStatus.data?.inheritanceEnabled && (
      <div className="inheritance-status-card">
        <div className="card-header">
          <InfoIcon />
          <h3>Settings Inheritance Active</h3>
        </div>
        <div className="card-body">
          <p>
            This property is part of <strong>{inheritanceStatus.data.groupName}</strong>
            {' '}and inherits settings from the group.
          </p>
          <div className="inheritance-stats">
            <span>Inherited: {inheritanceStatus.data.summary?.inheritedSettings || 0} settings</span>
            <span>Overrides: {inheritanceStatus.data.summary?.overriddenSettings || 0} settings</span>
          </div>
          <p className="last-sync">
            Last synced: {new Date(inheritanceStatus.data.lastSyncAt).toLocaleString()}
          </p>
        </div>
      </div>
    )}

    {/* Your settings form */}
    <form onSubmit={handleSubmit(handleSave)}>
      {/* Form fields */}

      <button type="submit" disabled={isUpdating}>
        {isUpdating ? 'Saving...' : 'Save Settings'}
      </button>
    </form>

    {/* Success/Error Messages */}
    {showSuccess && (
      <div className="success-message">
        {successMessage}
      </div>
    )}

    {updateError && (
      <div className="error-message">
        {updateError.message}
      </div>
    )}

    {/* Confirmation Dialog */}
    <ApplyToConfirmation
      isOpen={showConfirmation}
      scope={applyToScope}
      affectedCount={affectedCount}
      settingName="Your Setting Name"
      groupName={inheritanceStatus.data?.groupName}
      onConfirm={async () => {
        await confirmBulkUpdate();
        setShowSuccess(true);
      }}
      onCancel={cancelBulkUpdate}
    />
  </div>
);
```

#### Step 5: Handle Loading States

```typescript
// Show loading indicator during updates
if (isUpdating) {
  return <LoadingSpinner message="Updating properties..." />;
}

// Or use inline button state
<button disabled={isUpdating}>
  {isUpdating ? (
    <>
      <Spinner size="sm" />
      Updating {affectedCount} {affectedCount === 1 ? 'property' : 'properties'}...
    </>
  ) : (
    'Save Settings'
  )}
</button>
```

#### Step 6: Add TypeScript Types

```typescript
// Define your form data type
interface YourFormData {
  field1: string;
  field2: number;
  field3: boolean;
  // ... other fields
}

// Define setting type constant
const SETTING_TYPE = 'your_setting_type'; // Must match backend

// Use in API calls
const result = await applySettings({
  scope: applyToScope,
  propertyId: selectedPropertyId,
  settingUpdates: formData,
  settingType: SETTING_TYPE,
});
```

---

### Complete Example: Booking Rules Page

Here's a complete example showing all pieces together:

```typescript
// BookingRulesSettings.tsx
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { ApplyToSelector, ApplyToConfirmation, ApplyToScope } from '@/components/settings/ApplyToSelector';
import { useSettingsInheritance, useAffectedPropertiesCount } from '@/hooks/useSettingsInheritance';
import { useProperty } from '@/context/PropertyContext';
import api from '@/services/api';

interface BookingRulesForm {
  checkInTime: string;
  checkOutTime: string;
  cancellationPolicy: 'flexible' | 'moderate' | 'strict';
  minimumStay: number;
  maximumStay: number;
  advanceBookingDays: number;
}

export default function BookingRulesSettings() {
  // Property context
  const { selectedPropertyId, selectedProperty } = useProperty();

  // Form handling
  const { register, handleSubmit, reset, formState: { errors } } = useForm<BookingRulesForm>();

  // Multi-property state
  const [applyToScope, setApplyToScope] = useState<ApplyToScope>('single');
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Multi-property hooks
  const {
    useInheritanceStatus,
    applySettings,
    isUpdating,
    updateError,
    showConfirmation,
    confirmBulkUpdate,
    cancelBulkUpdate,
  } = useSettingsInheritance();

  const inheritanceStatus = useInheritanceStatus(selectedPropertyId);
  const affectedCount = useAffectedPropertiesCount(
    applyToScope,
    inheritanceStatus.data?.groupPropertyCount
  );

  // Load current settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await api.get(`/settings/booking-rules/${selectedPropertyId}`);
        reset(response.data.data);
      } catch (error) {
        console.error('Error loading booking rules:', error);
      }
    };

    if (selectedPropertyId) {
      loadSettings();
    }
  }, [selectedPropertyId, reset]);

  // Save handler
  const onSave = async (data: BookingRulesForm) => {
    setShowSuccess(false);

    try {
      if (applyToScope !== 'single') {
        // Multi-property update
        const result = await applySettings({
          scope: applyToScope,
          propertyId: selectedPropertyId,
          settingUpdates: data,
          settingType: 'booking_rules',
        });

        if (!result) return; // Cancelled or error

        setSuccessMessage(
          `Booking rules applied to ${result.propertiesUpdated} ${
            result.propertiesUpdated === 1 ? 'property' : 'properties'
          }`
        );
        setShowSuccess(true);

      } else {
        // Single property update
        await api.put(`/settings/booking-rules/${selectedPropertyId}`, data);

        setSuccessMessage('Booking rules updated successfully');
        setShowSuccess(true);
      }
    } catch (error) {
      console.error('Error saving booking rules:', error);
    }
  };

  return (
    <div className="booking-rules-settings">
      <div className="page-header">
        <h1>Booking Rules</h1>
        <p>Configure check-in/out times and booking policies</p>
      </div>

      {/* ApplyTo Selector */}
      <ApplyToSelector
        value={applyToScope}
        onChange={setApplyToScope}
        isInGroup={inheritanceStatus.data?.hasGroup || false}
        groupName={inheritanceStatus.data?.groupName}
        totalProperties={inheritanceStatus.data?.groupPropertyCount || 0}
        showWarning={true}
      />

      {/* Inheritance Status */}
      {inheritanceStatus.data?.inheritanceEnabled && (
        <div className="alert alert-info">
          <strong>Inheritance Active:</strong> This property inherits booking rules from{' '}
          {inheritanceStatus.data.groupName}. Changes with "This Property Only" will create overrides.
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit(onSave)} className="settings-form">
        <div className="form-section">
          <h2>Check-in & Check-out Times</h2>

          <div className="form-group">
            <label htmlFor="checkInTime">Check-in Time</label>
            <input
              id="checkInTime"
              type="time"
              {...register('checkInTime', { required: 'Check-in time is required' })}
              className={errors.checkInTime ? 'error' : ''}
            />
            {errors.checkInTime && (
              <span className="error-message">{errors.checkInTime.message}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="checkOutTime">Check-out Time</label>
            <input
              id="checkOutTime"
              type="time"
              {...register('checkOutTime', { required: 'Check-out time is required' })}
              className={errors.checkOutTime ? 'error' : ''}
            />
            {errors.checkOutTime && (
              <span className="error-message">{errors.checkOutTime.message}</span>
            )}
          </div>
        </div>

        <div className="form-section">
          <h2>Cancellation Policy</h2>

          <div className="form-group">
            <label htmlFor="cancellationPolicy">Policy Type</label>
            <select
              id="cancellationPolicy"
              {...register('cancellationPolicy', { required: 'Policy is required' })}
              className={errors.cancellationPolicy ? 'error' : ''}
            >
              <option value="">Select policy...</option>
              <option value="flexible">Flexible (Free cancellation up to 24h before)</option>
              <option value="moderate">Moderate (Free cancellation up to 5 days before)</option>
              <option value="strict">Strict (No free cancellation)</option>
            </select>
            {errors.cancellationPolicy && (
              <span className="error-message">{errors.cancellationPolicy.message}</span>
            )}
          </div>
        </div>

        <div className="form-section">
          <h2>Stay Requirements</h2>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="minimumStay">Minimum Stay (nights)</label>
              <input
                id="minimumStay"
                type="number"
                min="1"
                {...register('minimumStay', {
                  required: 'Minimum stay is required',
                  min: { value: 1, message: 'Minimum stay must be at least 1 night' }
                })}
                className={errors.minimumStay ? 'error' : ''}
              />
              {errors.minimumStay && (
                <span className="error-message">{errors.minimumStay.message}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="maximumStay">Maximum Stay (nights)</label>
              <input
                id="maximumStay"
                type="number"
                min="1"
                {...register('maximumStay', {
                  min: { value: 1, message: 'Maximum stay must be at least 1 night' }
                })}
                className={errors.maximumStay ? 'error' : ''}
              />
              {errors.maximumStay && (
                <span className="error-message">{errors.maximumStay.message}</span>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="advanceBookingDays">Advance Booking (days)</label>
            <input
              id="advanceBookingDays"
              type="number"
              min="0"
              {...register('advanceBookingDays', {
                required: 'Advance booking is required',
                min: { value: 0, message: 'Cannot be negative' }
              })}
              className={errors.advanceBookingDays ? 'error' : ''}
            />
            <small>How many days in advance bookings can be made (0 = same-day bookings allowed)</small>
            {errors.advanceBookingDays && (
              <span className="error-message">{errors.advanceBookingDays.message}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="form-actions">
          <button type="button" onClick={() => reset()}>
            Reset
          </button>
          <button type="submit" disabled={isUpdating} className="btn-primary">
            {isUpdating ? (
              <>
                <Spinner size="sm" />
                Updating {affectedCount} {affectedCount === 1 ? 'property' : 'properties'}...
              </>
            ) : (
              'Save Booking Rules'
            )}
          </button>
        </div>
      </form>

      {/* Success Message */}
      {showSuccess && (
        <div className="alert alert-success">
          <CheckIcon />
          {successMessage}
        </div>
      )}

      {/* Error Message */}
      {updateError && (
        <div className="alert alert-error">
          <ErrorIcon />
          Error: {updateError.message}
        </div>
      )}

      {/* Confirmation Dialog */}
      <ApplyToConfirmation
        isOpen={showConfirmation}
        scope={applyToScope}
        affectedCount={affectedCount}
        settingName="booking rules"
        groupName={inheritanceStatus.data?.groupName}
        onConfirm={async () => {
          await confirmBulkUpdate();
          setShowSuccess(true);
        }}
        onCancel={cancelBulkUpdate}
      />
    </div>
  );
}
```

---

## Backend Integration

### Adding Multi-Property Support to a Setting Type

To support a new setting type in the multi-property system:

#### Step 1: Define Setting Type

```javascript
// backend/src/services/settingsInheritance.js

// Add to SETTING_TYPE_ROUTES mapping
const SETTING_TYPE_ROUTES = {
  // ... existing types ...

  'your_setting_type': {
    model: YourModel,                    // Mongoose model
    updateMethod: 'updateYourSetting',   // Method name to call
    fields: ['field1', 'field2'],        // Fields to update
    validate: validateYourSettings,       // Optional validation function
  },

  // Example:
  'booking_rules': {
    model: Hotel,
    updateMethod: 'updateBookingRules',
    fields: ['checkInTime', 'checkOutTime', 'cancellationPolicy', 'minimumStay'],
    validate: (data) => {
      if (!data.checkInTime || !data.checkOutTime) {
        throw new Error('Check-in and check-out times are required');
      }
      return true;
    },
  },
};
```

#### Step 2: Implement Update Method

```javascript
// In your model or controller

async function updateYourSetting(propertyId, settingData) {
  // Validate input
  if (!propertyId) throw new Error('Property ID is required');
  if (!settingData) throw new Error('Setting data is required');

  // Find property
  const property = await Hotel.findById(propertyId);
  if (!property) throw new Error('Property not found');

  // Update settings
  Object.assign(property, settingData);

  // Save
  await property.save();

  return property;
}

// Example: Booking Rules
async function updateBookingRules(propertyId, rulesData) {
  const property = await Hotel.findById(propertyId);
  if (!property) throw new Error('Property not found');

  // Update booking rules
  property.bookingRules = {
    ...property.bookingRules,
    ...rulesData,
    updatedAt: new Date(),
  };

  await property.save();

  return property;
}
```

#### Step 3: Add Route Handler

```javascript
// backend/src/routes/yourSettings.js

const express = require('express');
const router = express.Router();
const { authenticateJWT, requireAdmin } = require('../middleware/auth');
const { validatePropertyAccess } = require('../middleware/propertyAccess');

// Get settings for a property
router.get('/:propertyId', authenticateJWT, validatePropertyAccess, async (req, res) => {
  try {
    const { propertyId } = req.params;

    const property = await Hotel.findById(propertyId);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    res.json({
      status: 'success',
      data: property.yourSettings, // or relevant fields
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update settings (handles both single and multi-property)
router.put('/:propertyId', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const settingData = req.body;

    // Extract multi-property parameters
    const { applyToAll, applyToGroup, ...actualSettings } = settingData;

    // Determine scope
    let scope = 'single';
    if (applyToAll) scope = 'all';
    else if (applyToGroup) scope = 'group';

    // If bulk update, use settings inheritance service
    if (scope !== 'single') {
      const settingsInheritance = require('../services/settingsInheritance');

      const result = await settingsInheritance.applySettings({
        scope,
        propertyId,
        settingType: 'your_setting_type',
        settingUpdates: actualSettings,
        userId: req.user._id,
      });

      return res.json({
        status: 'success',
        message: `Settings applied to ${result.propertiesUpdated} ${
          result.propertiesUpdated === 1 ? 'property' : 'properties'
        }`,
        data: result,
      });
    }

    // Single property update
    const property = await updateYourSetting(propertyId, actualSettings);

    res.json({
      status: 'success',
      message: 'Settings updated successfully',
      data: property,
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

#### Step 4: Register Route

```javascript
// backend/src/server.js

const yourSettingsRoutes = require('./routes/yourSettings');

// Register route
app.use('/api/v1/settings/your-settings', yourSettingsRoutes);
```

---

## API Reference

For complete API documentation, see: `backend/docs/MULTI_PROPERTY_API.md`

### Quick Reference

**Apply Settings (Universal Endpoint)**:
```
POST /api/v1/settings/apply
Body: {
  "scope": "single" | "group" | "all",
  "propertyId": "ObjectId",
  "settingType": "string",
  "settingUpdates": { ... }
}
```

**Get Affected Count**:
```
POST /api/v1/settings/affected-count
Body: {
  "scope": "group" | "all",
  "propertyId": "ObjectId"
}
```

**Get Inheritance Status**:
```
GET /api/v1/settings/inheritance-status/:propertyId
```

**Toggle Inheritance**:
```
PUT /api/v1/settings/toggle-inheritance
Body: {
  "propertyId": "ObjectId",
  "settingType": "string",
  "enabled": boolean
}
```

---

## Database Schema

### PropertyGroups Collection

```javascript
{
  _id: ObjectId,
  name: String,              // Required, unique per user
  description: String,
  groupType: {
    type: String,
    enum: ['chain', 'franchise', 'management_company', 'independent'],
    required: true
  },
  ownerId: {
    type: ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  properties: [{
    type: ObjectId,
    ref: 'Hotel'
  }],
  propertiesCount: Number,   // Cached count for performance
  settings: {
    baseCurrency: String,
    timezone: String,
    defaultLanguage: String,
    checkInTime: String,
    checkOutTime: String,
    // ... other base settings
  },
  contact: {
    email: String,
    phone: String
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  createdAt: Date,
  updatedAt: Date
}
```

### SettingsInheritance Collection

```javascript
{
  _id: ObjectId,
  propertyId: {
    type: ObjectId,
    ref: 'Hotel',
    required: true,
    index: true
  },
  groupId: {
    type: ObjectId,
    ref: 'PropertyGroup',
    required: true,
    index: true
  },
  settingType: {
    type: String,
    required: true,
    index: true
  },
  isInheriting: {
    type: Boolean,
    default: true
  },
  overrideValues: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  lastSyncedAt: Date,
  lastSyncedBy: {
    type: ObjectId,
    ref: 'User'
  },
  syncStatus: {
    type: String,
    enum: ['synced', 'pending', 'error', 'manual_override'],
    default: 'synced'
  },
  createdAt: Date,
  updatedAt: Date
}
```

### Hotels Collection (Updated Fields)

```javascript
{
  // ... existing fields ...

  // New multi-property fields
  groupId: {
    type: ObjectId,
    ref: 'PropertyGroup',
    index: true
  },
  groupMembership: {
    joinedAt: Date,
    addedBy: {
      type: ObjectId,
      ref: 'User'
    },
    leftAt: Date,     // If property left the group
    removedBy: {
      type: ObjectId,
      ref: 'User'
    }
  },
  multiProperty: {
    inheritanceEnabled: {
      type: Boolean,
      default: false
    },
    inheritanceSettings: {
      type: Map,
      of: Boolean,    // Per-setting-type inheritance toggle
      default: {}
    },
    overrideCount: {
      type: Number,
      default: 0
    }
  }
}
```

---

## Testing Guide

### Unit Testing

#### Testing Frontend Components

```typescript
// ApplyToSelector.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ApplyToSelector } from '@/components/settings/ApplyToSelector';

describe('ApplyToSelector', () => {
  it('should render all three scope options', () => {
    const onChange = jest.fn();

    render(
      <ApplyToSelector
        value="single"
        onChange={onChange}
        isInGroup={true}
        groupName="Test Group"
        totalProperties={5}
      />
    );

    expect(screen.getByText('This Property Only')).toBeInTheDocument();
    expect(screen.getByText('Property Group')).toBeInTheDocument();
    expect(screen.getByText('All My Properties')).toBeInTheDocument();
  });

  it('should call onChange when scope is changed', () => {
    const onChange = jest.fn();

    render(
      <ApplyToSelector
        value="single"
        onChange={onChange}
        isInGroup={true}
        groupName="Test Group"
        totalProperties={5}
      />
    );

    const groupOption = screen.getByLabelText(/Property Group/i);
    fireEvent.click(groupOption);

    expect(onChange).toHaveBeenCalledWith('group');
  });

  it('should hide group option if not in a group', () => {
    const onChange = jest.fn();

    render(
      <ApplyToSelector
        value="single"
        onChange={onChange}
        isInGroup={false}
      />
    );

    expect(screen.queryByText(/Property Group/i)).not.toBeInTheDocument();
  });
});
```

#### Testing Backend Services

```javascript
// settingsInheritance.test.js
const { applySettings } = require('../services/settingsInheritance');
const Hotel = require('../models/Hotel');
const PropertyGroup = require('../models/PropertyGroup');

describe('Settings Inheritance Service', () => {
  let testProperties;
  let testGroup;

  beforeEach(async () => {
    // Setup test data
    testGroup = await PropertyGroup.create({
      name: 'Test Group',
      groupType: 'chain',
      ownerId: testUserId,
    });

    testProperties = await Hotel.insertMany([
      { name: 'Property 1', groupId: testGroup._id },
      { name: 'Property 2', groupId: testGroup._id },
      { name: 'Property 3', groupId: testGroup._id },
    ]);
  });

  afterEach(async () => {
    // Cleanup
    await Hotel.deleteMany({});
    await PropertyGroup.deleteMany({});
  });

  test('should apply settings to single property', async () => {
    const result = await applySettings({
      scope: 'single',
      propertyId: testProperties[0]._id,
      settingType: 'booking_rules',
      settingUpdates: { checkInTime: '15:00' },
    });

    expect(result.success).toBe(true);
    expect(result.propertiesUpdated).toBe(1);

    const updated = await Hotel.findById(testProperties[0]._id);
    expect(updated.bookingRules.checkInTime).toBe('15:00');
  });

  test('should apply settings to all properties in group', async () => {
    const result = await applySettings({
      scope: 'group',
      propertyId: testProperties[0]._id,
      settingType: 'booking_rules',
      settingUpdates: { checkInTime: '15:00' },
    });

    expect(result.success).toBe(true);
    expect(result.propertiesUpdated).toBe(3);

    // Verify all properties updated
    const updated = await Hotel.find({ groupId: testGroup._id });
    updated.forEach(property => {
      expect(property.bookingRules.checkInTime).toBe('15:00');
    });
  });

  test('should respect property overrides', async () => {
    // Create override for one property
    testProperties[0].multiProperty.inheritanceSettings.set('booking_rules', false);
    testProperties[0].bookingRules.checkInTime = '16:00'; // Override value
    await testProperties[0].save();

    // Apply group update
    const result = await applySettings({
      scope: 'group',
      propertyId: testProperties[0]._id,
      settingType: 'booking_rules',
      settingUpdates: { checkInTime: '15:00' },
    });

    // Check that property with override didn't change
    const property1 = await Hotel.findById(testProperties[0]._id);
    expect(property1.bookingRules.checkInTime).toBe('16:00'); // Override preserved

    // Check that other properties did change
    const property2 = await Hotel.findById(testProperties[1]._id);
    expect(property2.bookingRules.checkInTime).toBe('15:00'); // Group value applied
  });
});
```

### Integration Testing

```javascript
// settings.integration.test.js
const request = require('supertest');
const app = require('../server');

describe('Settings API Integration Tests', () => {
  let authToken;
  let testProperties;

  beforeAll(async () => {
    // Get auth token
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'password' });

    authToken = response.body.token;

    // Create test properties
    // ... setup code
  });

  test('POST /api/v1/settings/apply - single property', async () => {
    const response = await request(app)
      .post('/api/v1/settings/apply')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        scope: 'single',
        propertyId: testProperties[0]._id,
        settingType: 'booking_rules',
        settingUpdates: {
          checkInTime: '15:00',
          checkOutTime: '11:00',
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('success');
    expect(response.body.data.propertiesUpdated).toBe(1);
  });

  test('POST /api/v1/settings/apply - property group', async () => {
    const response = await request(app)
      .post('/api/v1/settings/apply')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        scope: 'group',
        propertyId: testProperties[0]._id,
        settingType: 'booking_rules',
        settingUpdates: {
          checkInTime: '15:00',
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.data.propertiesUpdated).toBeGreaterThan(1);
  });

  test('POST /api/v1/settings/affected-count', async () => {
    const response = await request(app)
      .post('/api/v1/settings/affected-count')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        scope: 'group',
        propertyId: testProperties[0]._id,
      });

    expect(response.status).toBe(200);
    expect(response.body.data.count).toBeGreaterThan(0);
  });
});
```

### End-to-End Testing

```typescript
// e2e/multi-property.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Multi-Property Settings Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@example.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');

    // Wait for dashboard
    await page.waitForURL('/admin/dashboard');
  });

  test('should update single property', async ({ page }) => {
    // Navigate to settings
    await page.goto('/admin/settings/booking-rules');

    // Select "This Property Only"
    await page.click('input[value="single"]');

    // Update check-in time
    await page.fill('[name="checkInTime"]', '15:00');

    // Save
    await page.click('button[type="submit"]');

    // Verify success message
    await expect(page.locator('.success-message')).toContainText('updated successfully');
  });

  test('should show confirmation for bulk update', async ({ page }) => {
    // Navigate to settings
    await page.goto('/admin/settings/booking-rules');

    // Select "All My Properties"
    await page.click('input[value="all"]');

    // Update setting
    await page.fill('[name="checkInTime"]', '15:00');

    // Save
    await page.click('button[type="submit"]');

    // Confirmation dialog should appear
    await expect(page.locator('.confirmation-dialog')).toBeVisible();

    // Verify property count
    await expect(page.locator('.confirmation-dialog')).toContainText('12 properties');

    // Confirm
    await page.click('.confirmation-dialog button:has-text("Confirm")');

    // Verify success
    await expect(page.locator('.success-message')).toContainText('12 properties');
  });

  test('should create property group and apply settings', async ({ page }) => {
    // Navigate to portfolio dashboard
    await page.goto('/admin/portfolio');

    // Create group
    await page.click('button:has-text("Create Property Group")');
    await page.fill('[name="name"]', 'Test Group');
    await page.selectOption('[name="groupType"]', 'chain');
    await page.click('button:has-text("Create Group")');

    // Add properties
    await page.click('button:has-text("Add Properties")');
    await page.click('[data-property-id="property-1"]');
    await page.click('[data-property-id="property-2"]');
    await page.click('button:has-text("Add Selected")');

    // Navigate to settings
    await page.goto('/admin/settings/booking-rules');

    // Select "Property Group"
    await page.click('input[value="group"]');

    // Update and save
    await page.fill('[name="checkInTime"]', '15:00');
    await page.click('button[type="submit"]');

    // Confirm
    await page.click('.confirmation-dialog button:has-text("Confirm")');

    // Verify
    await expect(page.locator('.success-message')).toContainText('2 properties');
  });
});
```

---

## Code Examples

### Example 1: Custom Confirmation Logic

```typescript
// If you need custom logic before showing confirmation

const handleSave = async (data: FormData) => {
  // Custom validation before bulk update
  if (applyToScope !== 'single') {
    const hasHighImpact = checkIfHighImpact(data);

    if (hasHighImpact) {
      const userConfirmed = await customConfirmDialog(
        'This change has high impact. Are you absolutely sure?'
      );

      if (!userConfirmed) return;
    }
  }

  // Proceed with normal flow
  if (applyToScope !== 'single') {
    const result = await applySettings({
      scope: applyToScope,
      propertyId: selectedPropertyId,
      settingUpdates: data,
      settingType: 'your_type',
    });

    if (result) {
      setShowSuccess(true);
    }
  } else {
    // Single property logic
  }
};
```

### Example 2: Handling Partial Failures

```typescript
const handleSave = async (data: FormData) => {
  const result = await applySettings({
    scope: applyToScope,
    propertyId: selectedPropertyId,
    settingUpdates: data,
    settingType: 'your_type',
  });

  if (!result) return; // Cancelled or complete failure

  const { propertiesUpdated, propertiesFailed, errors } = result;

  if (propertiesFailed > 0) {
    // Partial failure - show details
    setErrorMessage(
      `Updated ${propertiesUpdated} properties, but ${propertiesFailed} failed.
       Failed properties: ${errors.map(e => e.propertyName).join(', ')}`
    );
    setShowPartialError(true);

    // Optionally retry failed properties
    const retryFailed = await confirmRetry();
    if (retryFailed) {
      await retryFailedProperties(errors);
    }
  } else {
    // Complete success
    setSuccessMessage(`All ${propertiesUpdated} properties updated successfully`);
    setShowSuccess(true);
  }
};
```

### Example 3: Progress Tracking for Large Updates

```typescript
const [updateProgress, setUpdateProgress] = useState<{
  current: number;
  total: number;
  currentProperty: string;
}>({ current: 0, total: 0, currentProperty: '' });

const handleSave = async (data: FormData) => {
  if (applyToScope !== 'single') {
    // Get affected count first
    const count = await getAffectedCount(applyToScope, selectedPropertyId);

    setUpdateProgress({ current: 0, total: count, currentProperty: '' });
    setShowProgressModal(true);

    // Apply with progress callback
    const result = await applySettingsWithProgress({
      scope: applyToScope,
      propertyId: selectedPropertyId,
      settingUpdates: data,
      settingType: 'your_type',
      onProgress: (current, total, propertyName) => {
        setUpdateProgress({ current, total, currentProperty: propertyName });
      },
    });

    setShowProgressModal(false);

    if (result) {
      setSuccessMessage(`Updated ${result.propertiesUpdated} properties`);
      setShowSuccess(true);
    }
  } else {
    // Single property logic
  }
};

// Progress Modal Component
{showProgressModal && (
  <div className="progress-modal">
    <h3>Updating Properties...</h3>
    <div className="progress-bar">
      <div
        className="progress-fill"
        style={{ width: `${(updateProgress.current / updateProgress.total) * 100}%` }}
      />
    </div>
    <p>
      {updateProgress.current} of {updateProgress.total} properties updated
    </p>
    <p className="current-property">
      Currently updating: {updateProgress.currentProperty}
    </p>
  </div>
)}
```

---

## Troubleshooting

### Common Issues

**Issue 1: ApplyTo selector not appearing**

**Cause**: User doesn't have access to multiple properties or multi-property feature is disabled

**Solution**:
```typescript
// Check in PropertyContext
const { isMultiProperty } = useProperty();

// ApplyToSelector automatically hides if !isMultiProperty
// Verify user has access to 2+ properties in database
```

**Issue 2: Confirmation dialog not showing**

**Cause**: Scope is set to 'single' or hook not properly configured

**Solution**:
```typescript
// Ensure scope is not 'single'
console.log('Current scope:', applyToScope); // Should be 'group' or 'all'

// Verify hook is setup correctly
const { showConfirmation } = useSettingsInheritance();
console.log('Show confirmation:', showConfirmation); // Should be true before confirming

// Check that ApplyToConfirmation component is in JSX
<ApplyToConfirmation
  isOpen={showConfirmation} // Must be the state from hook
  // ... other props
/>
```

**Issue 3: Settings not syncing to properties**

**Cause**: Inheritance disabled or override active

**Solution**:
```javascript
// Backend: Check inheritance status
const inheritance = await SettingsInheritance.findOne({
  propertyId,
  settingType
});

console.log('Inheritance enabled:', inheritance?.isInheriting); // Should be true
console.log('Has override:', !!inheritance?.overrideValues); // Should be false for sync

// Fix: Enable inheritance or remove override
await SettingsInheritance.updateOne(
  { propertyId, settingType },
  { $set: { isInheriting: true, overrideValues: {} } }
);
```

**Issue 4: Bulk update timeout**

**Cause**: Too many properties being updated at once

**Solution**:
```javascript
// Backend: Increase timeout for large operations
const BULK_UPDATE_TIMEOUT = 60000; // 60 seconds

// Or batch updates
async function applySettingsBatched(options) {
  const properties = await getAffectedProperties(options);
  const batchSize = 20;

  for (let i = 0; i < properties.length; i += batchSize) {
    const batch = properties.slice(i, i + batchSize);
    await Promise.all(batch.map(prop => updateProperty(prop, options)));
  }
}
```

**Issue 5: TypeScript errors**

**Cause**: Missing type definitions

**Solution**:
```typescript
// Ensure types are properly imported and defined
import type { ApplyToScope } from '@/components/settings/ApplyToSelector';

// Define your form data type
interface YourFormData {
  field1: string;
  field2: number;
  // ... all fields
}

// Use proper typing
const handleSave = async (data: YourFormData) => {
  // TypeScript will now check types
};
```

---

## Performance Optimization

### Frontend Optimization

**1. Memoize Expensive Calculations**

```typescript
import { useMemo } from 'react';

function YourComponent() {
  const affectedCount = useMemo(() => {
    if (applyToScope === 'single') return 1;
    if (applyToScope === 'group') return inheritanceStatus.data?.groupPropertyCount || 0;
    return properties.length;
  }, [applyToScope, inheritanceStatus.data, properties]);

  // ... rest of component
}
```

**2. Debounce API Calls**

```typescript
import { useDebouncedCallback } from 'use-debounce';

const debouncedSave = useDebouncedCallback(
  async (data) => {
    await handleSave(data);
  },
  1000 // 1 second debounce
);
```

**3. Cache Inheritance Status**

```typescript
// Hook already caches for 5 minutes
const inheritanceStatus = useInheritanceStatus(selectedPropertyId);

// If you need custom cache duration
const { data, refetch } = useQuery({
  queryKey: ['inheritance', selectedPropertyId],
  queryFn: () => fetchInheritanceStatus(selectedPropertyId),
  staleTime: 10 * 60 * 1000, // 10 minutes
});
```

### Backend Optimization

**1. Database Indexing**

```javascript
// Ensure indexes exist on frequently queried fields
PropertyGroupSchema.index({ ownerId: 1, status: 1 });
SettingsInheritanceSchema.index({ propertyId: 1, settingType: 1 });
HotelSchema.index({ groupId: 1 });
```

**2. Batch Database Operations**

```javascript
// Instead of sequential saves
for (const property of properties) {
  await property.save(); // SLOW
}

// Use bulk operations
await Hotel.bulkWrite(
  properties.map(property => ({
    updateOne: {
      filter: { _id: property._id },
      update: { $set: settingUpdates }
    }
  }))
); // FAST
```

**3. Parallel Processing**

```javascript
// Process multiple properties in parallel (with limit)
const pLimit = require('p-limit');
const limit = pLimit(10); // Max 10 concurrent

const updates = properties.map(property =>
  limit(() => updateProperty(property, settings))
);

await Promise.all(updates);
```

**4. Caching**

```javascript
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 }); // 5 minutes

async function getPropertyGroup(groupId) {
  const cacheKey = `group_${groupId}`;

  // Check cache first
  let group = cache.get(cacheKey);
  if (group) return group;

  // Fetch from database
  group = await PropertyGroup.findById(groupId);

  // Store in cache
  cache.set(cacheKey, group);

  return group;
}
```

---

## Security Considerations

### Authentication & Authorization

**1. Validate Property Access**

```javascript
// Middleware to ensure user has access to all affected properties
async function validateBulkPropertyAccess(req, res, next) {
  const { scope, propertyId } = req.body;
  const userId = req.user._id;

  try {
    let propertyIds = [];

    if (scope === 'single') {
      propertyIds = [propertyId];
    } else if (scope === 'group') {
      const property = await Hotel.findById(propertyId);
      if (!property.groupId) {
        return res.status(400).json({ error: 'Property not in a group' });
      }

      const groupProperties = await Hotel.find({ groupId: property.groupId });
      propertyIds = groupProperties.map(p => p._id);
    } else if (scope === 'all') {
      const userProperties = await Hotel.find({ 'access.userId': userId });
      propertyIds = userProperties.map(p => p._id);
    }

    // Verify user has access to ALL properties
    for (const propId of propertyIds) {
      const hasAccess = await userHasPropertyAccess(userId, propId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'You do not have access to all affected properties'
        });
      }
    }

    req.affectedPropertyIds = propertyIds;
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

**2. Rate Limiting**

```javascript
const rateLimit = require('express-rate-limit');

// Stricter rate limit for bulk operations
const bulkUpdateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 bulk updates per 15 min
  message: 'Too many bulk updates, please try again later',
  skip: (req) => req.body.scope === 'single', // Skip for single property
});

router.post('/settings/apply', bulkUpdateLimiter, async (req, res) => {
  // ... handler
});
```

**3. Input Validation**

```javascript
const Joi = require('joi');

const settingsUpdateSchema = Joi.object({
  scope: Joi.string().valid('single', 'group', 'all').required(),
  propertyId: Joi.string().required(),
  settingType: Joi.string().required(),
  settingUpdates: Joi.object().required(),
});

async function validateSettingsUpdate(req, res, next) {
  const { error } = settingsUpdateSchema.validate(req.body);

  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  next();
}
```

**4. Audit Logging**

```javascript
async function logBulkUpdate(userId, scope, propertyIds, settingType, success) {
  await AuditLog.create({
    userId,
    action: 'BULK_SETTINGS_UPDATE',
    scope,
    affectedProperties: propertyIds,
    settingType,
    success,
    timestamp: new Date(),
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
}
```

---

## Best Practices

### Code Organization

**1. Consistent Naming**

```typescript
// Good: Clear, consistent naming
const applyToScope = useState<ApplyToScope>('single');
const handleSaveBookingRules = async () => { /* ... */ };
const SETTING_TYPE_BOOKING_RULES = 'booking_rules';

// Bad: Inconsistent, unclear
const scope = useState('single');
const save = async () => { /* ... */ };
const TYPE = 'br';
```

**2. DRY Principle**

```typescript
// Extract common logic into reusable functions
function useMultiPropertySave(settingType: string) {
  const { applySettings } = useSettingsInheritance();
  const { selectedPropertyId } = useProperty();

  return async (scope: ApplyToScope, data: any) => {
    if (scope !== 'single') {
      return await applySettings({
        scope,
        propertyId: selectedPropertyId,
        settingUpdates: data,
        settingType,
      });
    } else {
      // Handle single property save
      return await saveSingleProperty(selectedPropertyId, data);
    }
  };
}

// Use in components
const saveSettings = useMultiPropertySave('booking_rules');
await saveSettings(applyToScope, formData);
```

**3. Error Handling**

```typescript
// Always handle errors gracefully
try {
  const result = await applySettings(options);
  if (!result) {
    // User cancelled or validation failed
    return;
  }
  handleSuccess(result);
} catch (error) {
  console.error('Settings update failed:', error);

  // Show user-friendly error message
  if (error.response?.status === 403) {
    showError('You do not have permission to update these properties');
  } else if (error.response?.status === 500) {
    showError('Server error. Please try again or contact support.');
  } else {
    showError('Failed to update settings. Please try again.');
  }
}
```

**4. Documentation**

```typescript
/**
 * Applies booking rules to one or more properties based on scope
 *
 * @param scope - Where to apply: 'single', 'group', or 'all'
 * @param formData - Booking rules data to apply
 * @returns Promise<UpdateResult> - Result with count of updated properties
 *
 * @throws {Error} If property access validation fails
 * @throws {Error} If setting update fails
 *
 * @example
 * const result = await handleSave('group', {
 *   checkInTime: '15:00',
 *   checkOutTime: '11:00'
 * });
 */
async function handleSave(scope: ApplyToScope, formData: BookingRulesForm): Promise<UpdateResult> {
  // Implementation
}
```

---

## Conclusion

This developer guide provides comprehensive information for integrating multi-property settings management into THE PENTOUZ Hotel Management System.

**Key Takeaways**:
- Follow the 6-step pattern for frontend integration
- Use the settings inheritance service for backend support
- Test thoroughly at all levels (unit, integration, e2e)
- Optimize performance for large portfolios
- Implement proper security measures
- Follow coding best practices

**Resources**:
- API Documentation: `backend/docs/MULTI_PROPERTY_API.md`
- User Guide: `docs/user-guides/MULTI_PROPERTY_USER_GUIDE.md`
- Code Examples: `frontend/src/components/settings/` (reference implementations)
- Support: developers@thepentouz.com

**Contributing**:
When adding new features or fixing bugs:
1. Follow existing patterns and conventions
2. Write tests for new functionality
3. Update documentation
4. Submit pull request with clear description
5. Ensure all tests pass

**Questions?**
Contact the development team at: developers@thepentouz.com

---

**Version**: 1.0
**Last Updated**: January 2025
**Maintained by**: THE PENTOUZ Development Team
