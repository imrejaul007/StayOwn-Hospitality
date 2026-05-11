# Multi-Property Settings API Documentation

## Overview

This API provides comprehensive multi-property settings management with support for inheritance, overrides, and bulk operations across properties, groups, and portfolios.

## Base URL

```
/api/v1/settings
```

## Authentication

All endpoints require authentication token in header:

```
Authorization: Bearer <token>
```

## Table of Contents

1. [Settings Application Endpoints](#settings-application-endpoints)
2. [Inheritance Management](#inheritance-management)
3. [Property Group Management](#property-group-management)
4. [Supported Setting Types](#supported-setting-types)
5. [Response Formats](#response-formats)
6. [Error Codes](#error-codes)

---

## Settings Application Endpoints

### 1. Apply Settings (Universal Endpoint)

**POST** `/api/v1/settings/apply`

Universal endpoint to apply settings to single property, group, or all properties. Supports all 28 setting types from Phase 4.

**Request Body:**
```json
{
  "scope": "single",
  "propertyId": "507f1f77bcf86cd799439011",
  "settingType": "booking_rules",
  "settingUpdates": {
    "checkInTime": "15:00",
    "checkOutTime": "11:00",
    "cancellationPolicy": "flexible"
  }
}
```

**Parameters:**
- `scope` (required): `"single"` | `"group"` | `"all"`
  - `single`: Apply to one property only
  - `group`: Apply to all properties in the same group
  - `all`: Apply to all properties owned by user
- `propertyId` (required): MongoDB ObjectId of the property
- `settingType` (required): Type of setting (see [Supported Setting Types](#supported-setting-types))
- `settingUpdates` (required): Object containing the settings to update

**Response:**
```json
{
  "status": "success",
  "message": "Settings applied to 5 properties",
  "data": {
    "success": true,
    "scope": "group",
    "propertiesUpdated": 5,
    "propertiesFailed": 0,
    "totalProperties": 5,
    "syncDuration": 1234,
    "propertyIds": [
      "507f1f77bcf86cd799439011",
      "507f1f77bcf86cd799439012",
      "507f1f77bcf86cd799439013"
    ],
    "errors": []
  }
}
```

**Example Usage:**

```javascript
// Apply to single property
const response = await fetch('/api/v1/settings/apply', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    scope: 'single',
    propertyId: '507f1f77bcf86cd799439011',
    settingType: 'booking_rules',
    settingUpdates: {
      checkInTime: '14:00',
      checkOutTime: '12:00'
    }
  })
});

// Apply to property group
const response = await fetch('/api/v1/settings/apply', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    scope: 'group',
    propertyId: '507f1f77bcf86cd799439011', // Any property in the group
    settingType: 'booking_rules',
    settingUpdates: {
      checkInTime: '14:00',
      checkOutTime: '12:00'
    }
  })
});

// Apply to all properties
const response = await fetch('/api/v1/settings/apply', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    scope: 'all',
    propertyId: '507f1f77bcf86cd799439011', // Used to identify user
    settingType: 'booking_rules',
    settingUpdates: {
      checkInTime: '14:00',
      checkOutTime: '12:00'
    }
  })
});
```

---

### 2. Get Affected Properties Count

**POST** `/api/v1/settings/affected-count`

Calculate how many properties will be affected by a settings change before applying it.

**Request Body:**
```json
{
  "scope": "group",
  "propertyId": "507f1f77bcf86cd799439011"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "count": 5
  }
}
```

**Use Case:**
Display confirmation dialog showing: "This will affect 5 properties. Continue?"

---

### 3. Get Inheritance Status

**GET** `/api/v1/settings/inheritance-status/:propertyId`

Get multi-property inheritance status and configuration for a specific property.

**Response:**
```json
{
  "success": true,
  "data": {
    "propertyId": "507f1f77bcf86cd799439011",
    "propertyName": "Grand Hotel Downtown",
    "hasGroup": true,
    "groupId": "507f1f77bcf86cd799439020",
    "groupName": "Downtown Properties",
    "inheritanceEnabled": true,
    "lastSyncAt": "2025-01-17T10:30:00Z",
    "canOverride": true,
    "summary": {
      "totalSettings": 28,
      "inheritedSettings": 20,
      "overriddenSettings": 8,
      "lastSyncedBy": "John Doe",
      "syncStatus": "synced"
    }
  }
}
```

---

## Inheritance Management

### 4. Toggle Inheritance

**PUT** `/api/v1/settings/toggle-inheritance`

Enable or disable inheritance for a specific setting type on a property.

**Request Body:**
```json
{
  "propertyId": "507f1f77bcf86cd799439011",
  "settingType": "booking_rules",
  "enabled": true
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Inheritance enabled for booking_rules",
  "data": {
    "success": true,
    "message": "Inheritance enabled for booking_rules",
    "inheritance": {
      "propertyId": "507f1f77bcf86cd799439011",
      "groupId": "507f1f77bcf86cd799439020",
      "settingType": "booking_rules",
      "isInheriting": true,
      "syncStatus": "pending"
    }
  }
}
```

---

### 5. Set Override

**PUT** `/api/v1/settings/override`

Set property-specific override values for a setting type, disabling inheritance.

**Request Body:**
```json
{
  "propertyId": "507f1f77bcf86cd799439011",
  "settingType": "booking_rules",
  "overrideValues": {
    "checkInTime": "16:00",
    "checkOutTime": "10:00"
  }
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Override set successfully",
  "data": {
    "success": true,
    "message": "Override set successfully",
    "inheritance": {
      "propertyId": "507f1f77bcf86cd799439011",
      "settingType": "booking_rules",
      "isInheriting": false,
      "hasOverride": true,
      "overrideValues": {
        "checkInTime": "16:00",
        "checkOutTime": "10:00"
      },
      "syncStatus": "manual_override"
    }
  }
}
```

---

### 6. Remove Override

**DELETE** `/api/v1/settings/override`

Remove property-specific override and revert to group inheritance.

**Request Body:**
```json
{
  "propertyId": "507f1f77bcf86cd799439011",
  "settingType": "booking_rules"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Override removed, inheritance restored",
  "data": {
    "success": true,
    "message": "Override removed, inheritance restored",
    "inheritance": {
      "propertyId": "507f1f77bcf86cd799439011",
      "settingType": "booking_rules",
      "isInheriting": true,
      "hasOverride": false,
      "syncStatus": "synced"
    }
  }
}
```

---

### 7. Get Group Inheritance Summary

**GET** `/api/v1/settings/group-summary/:groupId`

Get comprehensive inheritance summary for all properties in a group.

**Response:**
```json
{
  "status": "success",
  "data": {
    "groupId": "507f1f77bcf86cd799439020",
    "groupName": "Downtown Properties",
    "totalProperties": 5,
    "inheritingProperties": 4,
    "overridingProperties": 1,
    "settingsSummary": {
      "booking_rules": {
        "inheriting": 4,
        "overriding": 1,
        "lastSyncedAt": "2025-01-17T10:30:00Z"
      },
      "room_types": {
        "inheriting": 5,
        "overriding": 0,
        "lastSyncedAt": "2025-01-17T09:15:00Z"
      }
    },
    "lastSyncedAt": "2025-01-17T10:30:00Z",
    "lastSyncedBy": "John Doe"
  }
}
```

---

## Property Group Management

Base URL: `/api/v1/property-groups`

### 8. Get All Property Groups

**GET** `/api/v1/property-groups`

Get all property groups for the authenticated user.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `status` (optional): Filter by status (`active`, `inactive`, `suspended`)
- `groupType` (optional): Filter by type (`chain`, `franchise`, `management_company`, `independent`)

**Response:**
```json
{
  "status": "success",
  "data": {
    "groups": [
      {
        "_id": "507f1f77bcf86cd799439020",
        "name": "Downtown Properties",
        "description": "All properties in downtown area",
        "groupType": "chain",
        "ownerId": "507f1f77bcf86cd799439000",
        "properties": [
          {
            "_id": "507f1f77bcf86cd799439011",
            "name": "Grand Hotel Downtown",
            "address": {
              "city": "New York"
            },
            "totalRooms": 120
          }
        ],
        "propertiesCount": 5,
        "status": "active",
        "createdAt": "2025-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 3,
      "pages": 1
    }
  }
}
```

---

### 9. Get Single Property Group

**GET** `/api/v1/property-groups/:id`

Get detailed information about a specific property group.

**Response:**
```json
{
  "status": "success",
  "data": {
    "group": {
      "_id": "507f1f77bcf86cd799439020",
      "name": "Downtown Properties",
      "description": "All properties in downtown area",
      "groupType": "chain",
      "ownerId": "507f1f77bcf86cd799439000",
      "properties": [...],
      "propertiesCount": 5,
      "settings": {
        "baseCurrency": "USD",
        "timezone": "America/New_York",
        "defaultLanguage": "en",
        "checkInTime": "15:00",
        "checkOutTime": "11:00"
      },
      "status": "active",
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-01-17T10:30:00Z"
    }
  }
}
```

---

### 10. Create Property Group

**POST** `/api/v1/property-groups`

Create a new property group.

**Request Body:**
```json
{
  "name": "Downtown Properties",
  "description": "All properties in downtown area",
  "groupType": "chain",
  "contact": {
    "email": "downtown@example.com",
    "phone": "+1234567890"
  },
  "settings": {
    "baseCurrency": "USD",
    "timezone": "America/New_York",
    "defaultLanguage": "en"
  }
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Property group created successfully",
  "data": {
    "group": {
      "_id": "507f1f77bcf86cd799439020",
      "name": "Downtown Properties",
      ...
    }
  }
}
```

---

### 11. Update Property Group

**PUT** `/api/v1/property-groups/:id`

Update an existing property group.

**Request Body:**
```json
{
  "name": "Updated Downtown Properties",
  "description": "Updated description",
  "status": "active"
}
```

---

### 12. Delete Property Group

**DELETE** `/api/v1/property-groups/:id`

Delete a property group. Properties will be unlinked from the group.

**Response:**
```json
{
  "status": "success",
  "message": "Property group deleted successfully"
}
```

---

### 13. Add Properties to Group

**POST** `/api/v1/property-groups/:id/properties`

Add one or more properties to a group.

**Request Body:**
```json
{
  "propertyIds": [
    "507f1f77bcf86cd799439011",
    "507f1f77bcf86cd799439012"
  ]
}
```

---

### 14. Remove Properties from Group

**DELETE** `/api/v1/property-groups/:id/properties`

Remove one or more properties from a group.

**Request Body:**
```json
{
  "propertyIds": [
    "507f1f77bcf86cd799439011"
  ]
}
```

---

### 15. Sync Group Settings

**POST** `/api/v1/property-groups/:id/sync`

Manually trigger sync of group settings to all properties.

**Request Body (optional):**
```json
{
  "settingsToSync": {
    "checkInTime": "15:00",
    "checkOutTime": "11:00"
  }
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Settings synced to 5 properties",
  "data": {
    "propertiesUpdated": 5,
    "propertiesFailed": 0,
    "syncDuration": 1234
  }
}
```

---

## Supported Setting Types

The API supports 28 different setting types from Phase 4:

### Core Settings
1. **booking_rules** - Check-in/out times, cancellation policies
2. **room_types** - Room type configurations
3. **room_types_update** - Room type updates

### Pricing & Revenue
4. **seasonal_pricing_season** - Seasonal pricing configurations
5. **seasonal_pricing_period** - Pricing periods
6. **room_taxes** - Room tax settings
7. **pos_taxes** - POS tax configurations
8. **extra_person_pricing** - Extra person charges

### Communications
9. **message_templates** - Notification templates
10. **email_campaign** - Email marketing campaigns

### Integrations
11. **ota_channel_configuration** - OTA channel settings
12. **payment_method** - Payment gateway configurations
13. **integration_settings** - Third-party integrations

### Operations
14. **allotment_global_settings** - Inventory allotment rules
15. **web_settings** - Website and booking engine settings
16. **display_preferences** - UI display settings
17. **hotel_settings** - General hotel configurations
18. **system_settings** - System-wide settings

### Guest Management
19. **guest_preferences** - Guest preference templates
20. **loyalty_settings** - Loyalty program configuration
21. **vip_settings** - VIP guest handling

### Staff & Operations
22. **housekeeping_settings** - Housekeeping workflows
23. **maintenance_settings** - Maintenance schedules
24. **staff_settings** - Staff management
25. **department_settings** - Department configurations

### Financial
26. **revenue_accounts** - Revenue account mapping
27. **billing_settings** - Billing and invoicing
28. **settlement_settings** - Payment settlement rules

---

## Response Formats

### Success Response

```json
{
  "status": "success",
  "message": "Operation completed successfully",
  "data": {
    // Response data
  }
}
```

### Error Response

```json
{
  "status": "error",
  "message": "Error description",
  "code": "ERROR_CODE",
  "details": {
    // Additional error details
  }
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|------------|-------------|
| `MISSING_REQUIRED_FIELDS` | 400 | Required fields are missing |
| `INVALID_SCOPE` | 400 | Invalid scope value |
| `INVALID_SETTING_TYPE` | 400 | Unknown setting type |
| `PROPERTY_NOT_FOUND` | 404 | Property does not exist |
| `GROUP_NOT_FOUND` | 404 | Property group does not exist |
| `NOT_IN_GROUP` | 400 | Property is not part of a group |
| `CANNOT_OVERRIDE` | 403 | Property cannot override group settings |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `SERVER_ERROR` | 500 | Internal server error |

---

## Usage Examples

### Complete Workflow Example

```javascript
// 1. Check how many properties will be affected
const countResponse = await fetch('/api/v1/settings/affected-count', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    scope: 'group',
    propertyId: currentPropertyId
  })
});

const { data: { count } } = await countResponse.json();

// 2. Show confirmation to user
if (confirm(`This will affect ${count} properties. Continue?`)) {

  // 3. Apply settings
  const applyResponse = await fetch('/api/v1/settings/apply', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      scope: 'group',
      propertyId: currentPropertyId,
      settingType: 'booking_rules',
      settingUpdates: {
        checkInTime: '14:00',
        checkOutTime: '12:00'
      }
    })
  });

  const result = await applyResponse.json();

  // 4. Show success message
  alert(`Settings applied to ${result.data.propertiesUpdated} properties`);
}

// 5. Check inheritance status
const statusResponse = await fetch(
  `/api/v1/settings/inheritance-status/${currentPropertyId}`,
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);

const status = await statusResponse.json();
console.log('Inheritance status:', status.data);
```

---

## Rate Limiting

- **Rate Limit**: 1000 requests per minute per user
- **Burst Limit**: 100 requests per 10 seconds
- **Headers**:
  - `X-RateLimit-Limit`: Maximum requests
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset timestamp

---

## Versioning

Current API Version: **v1**

All endpoints are prefixed with `/api/v1/`

Future versions will be available at `/api/v2/`, `/api/v3/`, etc.

---

## Support

For API support and questions:
- Email: api-support@example.com
- Documentation: https://docs.example.com
- Status Page: https://status.example.com

---

## Changelog

### Version 1.0.0 (2025-01-17)
- Initial release
- 15 endpoints total
- Support for 28 setting types
- Multi-property inheritance system
- Property group management
- Override and inheritance controls
