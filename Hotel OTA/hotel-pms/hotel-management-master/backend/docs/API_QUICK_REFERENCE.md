# Multi-Property Settings API - Quick Reference

## Base URLs
- **Settings**: `/api/v1/settings`
- **Property Groups**: `/api/v1/property-groups`

## Authentication
All endpoints require Bearer token:
```
Authorization: Bearer <token>
```

---

## Settings API Endpoints

### Universal Apply Endpoint
```http
POST /api/v1/settings/apply
Content-Type: application/json

{
  "scope": "single|group|all",
  "propertyId": "xxx",
  "settingType": "booking_rules",
  "settingUpdates": { ... }
}
```

### Get Affected Count
```http
POST /api/v1/settings/affected-count
Content-Type: application/json

{
  "scope": "single|group|all",
  "propertyId": "xxx"
}
```

### Get Inheritance Status
```http
GET /api/v1/settings/inheritance-status/:propertyId
```

### Toggle Inheritance
```http
PUT /api/v1/settings/toggle-inheritance
Content-Type: application/json

{
  "propertyId": "xxx",
  "settingType": "booking_rules",
  "enabled": true
}
```

### Set Override
```http
PUT /api/v1/settings/override
Content-Type: application/json

{
  "propertyId": "xxx",
  "settingType": "booking_rules",
  "overrideValues": { ... }
}
```

### Remove Override
```http
DELETE /api/v1/settings/override
Content-Type: application/json

{
  "propertyId": "xxx",
  "settingType": "booking_rules"
}
```

### Get Group Summary
```http
GET /api/v1/settings/group-summary/:groupId
```

---

## Property Groups API Endpoints

### List Groups
```http
GET /api/v1/property-groups?page=1&limit=20&status=active
```

### Get Single Group
```http
GET /api/v1/property-groups/:id
```

### Create Group
```http
POST /api/v1/property-groups
Content-Type: application/json

{
  "name": "Downtown Properties",
  "groupType": "chain",
  "description": "..."
}
```

### Update Group
```http
PUT /api/v1/property-groups/:id
Content-Type: application/json

{
  "name": "Updated Name",
  "status": "active"
}
```

### Delete Group
```http
DELETE /api/v1/property-groups/:id
```

### Add Properties
```http
POST /api/v1/property-groups/:id/properties
Content-Type: application/json

{
  "propertyIds": ["xxx", "yyy"]
}
```

### Remove Properties
```http
DELETE /api/v1/property-groups/:id/properties
Content-Type: application/json

{
  "propertyIds": ["xxx"]
}
```

### Sync Settings
```http
POST /api/v1/property-groups/:id/sync
Content-Type: application/json

{
  "settingsToSync": { ... }
}
```

---

## Setting Types (28 Total)

### Core
- `booking_rules`
- `room_types`
- `room_types_update`

### Pricing
- `seasonal_pricing_season`
- `seasonal_pricing_period`
- `room_taxes`
- `pos_taxes`
- `extra_person_pricing`

### Communications
- `message_templates`
- `email_campaign`

### Integrations
- `ota_channel_configuration`
- `payment_method`
- `integration_settings`

### Operations
- `allotment_global_settings`
- `web_settings`
- `display_preferences`
- `hotel_settings`
- `system_settings`

### Guest
- `guest_preferences`
- `loyalty_settings`
- `vip_settings`

### Staff
- `housekeeping_settings`
- `maintenance_settings`
- `staff_settings`
- `department_settings`

### Financial
- `revenue_accounts`
- `billing_settings`
- `settlement_settings`

---

## Response Format

### Success
```json
{
  "status": "success",
  "message": "...",
  "data": { ... }
}
```

### Error
```json
{
  "status": "error",
  "message": "...",
  "code": "ERROR_CODE"
}
```

---

## Common Scopes
- `single` - Apply to one property
- `group` - Apply to all properties in group
- `all` - Apply to all user properties

---

## HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Server Error

---

## Quick Usage Example

```javascript
// 1. Check count
const count = await fetch('/api/v1/settings/affected-count', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    scope: 'group',
    propertyId: currentPropertyId
  })
}).then(r => r.json());

// 2. Apply settings
const result = await fetch('/api/v1/settings/apply', {
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
}).then(r => r.json());

console.log(`Applied to ${result.data.propertiesUpdated} properties`);
```

---

For detailed documentation, see: [MULTI_PROPERTY_API.md](./MULTI_PROPERTY_API.md)
