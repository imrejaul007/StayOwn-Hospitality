# Multi-Property Settings API - Testing Guide

## Overview

This guide provides comprehensive testing instructions for the 25 API endpoints in the multi-property settings management system.

---

## Prerequisites

### Required Tools
- **Postman** or **REST Client** (VS Code extension)
- **Node.js** 18+ (for backend)
- **MongoDB** connection
- **Redis** (optional, for cache testing)

### Setup
1. Ensure backend server is running: `npm run dev`
2. Have a valid authentication token
3. Know your test property and group IDs

---

## Getting Started

### 1. Authentication

First, obtain an authentication token:

```http
POST http://localhost:4000/api/v1/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "status": "success",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "data": {
    "user": { ... }
  }
}
```

**Save the token** - you'll need it for all subsequent requests.

### 2. Get Your Property IDs

```http
GET http://localhost:4000/api/v1/admin
Authorization: Bearer <your-token>
```

Note down property IDs for testing.

---

## Test Scenarios

## Scenario 1: Basic Settings Application

### Test 1.1: Apply Settings to Single Property

**Objective**: Update check-in/out times for one property

```http
POST http://localhost:4000/api/v1/settings/apply
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "scope": "single",
  "propertyId": "507f1f77bcf86cd799439011",
  "settingType": "booking_rules",
  "settingUpdates": {
    "checkInTime": "14:00",
    "checkOutTime": "12:00"
  }
}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Settings applied to 1 property",
  "data": {
    "success": true,
    "scope": "single",
    "propertiesUpdated": 1,
    "syncDuration": 89
  }
}
```

**Validation:**
- ✓ Status code: 200
- ✓ propertiesUpdated: 1
- ✓ No errors in response

---

### Test 1.2: Check Affected Count Before Applying

**Objective**: Preview how many properties will be affected

```http
POST http://localhost:4000/api/v1/settings/affected-count
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "scope": "group",
  "propertyId": "507f1f77bcf86cd799439011"
}
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "count": 5
  }
}
```

**Validation:**
- ✓ Status code: 200
- ✓ count is a positive integer
- ✓ Count matches expected group size

---

### Test 1.3: Apply Settings to Group

**Objective**: Apply settings to all properties in a group

```http
POST http://localhost:4000/api/v1/settings/apply
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "scope": "group",
  "propertyId": "507f1f77bcf86cd799439011",
  "settingType": "booking_rules",
  "settingUpdates": {
    "checkInTime": "15:00",
    "checkOutTime": "11:00"
  }
}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Settings applied to 5 properties",
  "data": {
    "success": true,
    "scope": "group",
    "propertiesUpdated": 5,
    "propertiesFailed": 0,
    "syncDuration": 456
  }
}
```

**Validation:**
- ✓ Status code: 200
- ✓ propertiesUpdated matches affected count
- ✓ propertiesFailed: 0

---

### Test 1.4: Apply Settings to All Properties

**Objective**: Apply settings to all properties owned by user

```http
POST http://localhost:4000/api/v1/settings/apply
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "scope": "all",
  "propertyId": "507f1f77bcf86cd799439011",
  "settingType": "booking_rules",
  "settingUpdates": {
    "checkInTime": "14:00",
    "checkOutTime": "11:00"
  }
}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Settings applied to 15 properties",
  "data": {
    "success": true,
    "scope": "all",
    "propertiesUpdated": 15,
    "syncDuration": 1234
  }
}
```

**Validation:**
- ✓ Status code: 200
- ✓ propertiesUpdated equals total user properties
- ✓ Sync duration reasonable (< 2s for 50 properties)

---

## Scenario 2: Inheritance Management

### Test 2.1: Get Inheritance Status

**Objective**: Check inheritance configuration for a property

```http
GET http://localhost:4000/api/v1/settings/inheritance-status/507f1f77bcf86cd799439011
Authorization: Bearer <your-token>
```

**Expected Response:**
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
    "canOverride": true
  }
}
```

**Validation:**
- ✓ Status code: 200
- ✓ Property details correct
- ✓ Group information present (if applicable)

---

### Test 2.2: Toggle Inheritance

**Objective**: Enable/disable inheritance for a setting type

```http
PUT http://localhost:4000/api/v1/settings/toggle-inheritance
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "propertyId": "507f1f77bcf86cd799439011",
  "settingType": "booking_rules",
  "enabled": false
}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Inheritance disabled for booking_rules",
  "data": {
    "success": true,
    "inheritance": {
      "propertyId": "507f1f77bcf86cd799439011",
      "settingType": "booking_rules",
      "isInheriting": false,
      "syncStatus": "manual_override"
    }
  }
}
```

**Validation:**
- ✓ Status code: 200
- ✓ isInheriting matches requested state
- ✓ syncStatus updated correctly

---

### Test 2.3: Set Property Override

**Objective**: Set custom values for a property (disable inheritance)

```http
PUT http://localhost:4000/api/v1/settings/override
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "propertyId": "507f1f77bcf86cd799439011",
  "settingType": "booking_rules",
  "overrideValues": {
    "checkInTime": "16:00",
    "checkOutTime": "10:00"
  }
}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Override set successfully",
  "data": {
    "success": true,
    "inheritance": {
      "hasOverride": true,
      "overrideValues": {
        "checkInTime": "16:00",
        "checkOutTime": "10:00"
      }
    }
  }
}
```

**Validation:**
- ✓ Status code: 200
- ✓ hasOverride: true
- ✓ overrideValues saved correctly

---

### Test 2.4: Remove Override

**Objective**: Remove custom values and revert to group inheritance

```http
DELETE http://localhost:4000/api/v1/settings/override
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "propertyId": "507f1f77bcf86cd799439011",
  "settingType": "booking_rules"
}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Override removed, inheritance restored",
  "data": {
    "success": true,
    "inheritance": {
      "isInheriting": true,
      "hasOverride": false
    }
  }
}
```

**Validation:**
- ✓ Status code: 200
- ✓ hasOverride: false
- ✓ isInheriting: true

---

### Test 2.5: Get Group Inheritance Summary

**Objective**: Get overview of inheritance for all properties in group

```http
GET http://localhost:4000/api/v1/settings/group-summary/507f1f77bcf86cd799439020
Authorization: Bearer <your-token>
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "groupId": "507f1f77bcf86cd799439020",
    "groupName": "Downtown Properties",
    "totalProperties": 5,
    "inheritingProperties": 4,
    "overridingProperties": 1,
    "settingsSummary": { ... }
  }
}
```

**Validation:**
- ✓ Status code: 200
- ✓ Property counts match expected values
- ✓ Settings summary includes all setting types

---

## Scenario 3: Property Group Management

### Test 3.1: List Property Groups

**Objective**: Get all property groups with pagination

```http
GET http://localhost:4000/api/v1/property-groups?page=1&limit=20
Authorization: Bearer <your-token>
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "groups": [
      {
        "_id": "507f1f77bcf86cd799439020",
        "name": "Downtown Properties",
        "propertiesCount": 5,
        "status": "active"
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

**Validation:**
- ✓ Status code: 200
- ✓ Groups array present
- ✓ Pagination info correct

---

### Test 3.2: Create Property Group

**Objective**: Create a new property group

```http
POST http://localhost:4000/api/v1/property-groups
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "name": "Beachfront Properties",
  "description": "All properties near the beach",
  "groupType": "chain",
  "settings": {
    "baseCurrency": "USD",
    "timezone": "America/Los_Angeles"
  }
}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Property group created successfully",
  "data": {
    "group": {
      "_id": "507f1f77bcf86cd799439025",
      "name": "Beachfront Properties",
      "groupType": "chain",
      "status": "active"
    }
  }
}
```

**Validation:**
- ✓ Status code: 201
- ✓ Group ID generated
- ✓ All fields saved correctly

---

### Test 3.3: Update Property Group

**Objective**: Update group details

```http
PUT http://localhost:4000/api/v1/property-groups/507f1f77bcf86cd799439025
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "name": "Premium Beachfront Properties",
  "status": "active"
}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Property group updated successfully",
  "data": {
    "group": {
      "_id": "507f1f77bcf86cd799439025",
      "name": "Premium Beachfront Properties"
    }
  }
}
```

**Validation:**
- ✓ Status code: 200
- ✓ Changes reflected in response

---

### Test 3.4: Add Properties to Group

**Objective**: Add multiple properties to a group

```http
POST http://localhost:4000/api/v1/property-groups/507f1f77bcf86cd799439025/properties
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "propertyIds": [
    "507f1f77bcf86cd799439011",
    "507f1f77bcf86cd799439012"
  ]
}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Properties added to group successfully",
  "data": {
    "propertiesAdded": 2,
    "group": { ... }
  }
}
```

**Validation:**
- ✓ Status code: 200
- ✓ Properties count updated
- ✓ All properties added successfully

---

### Test 3.5: Sync Group Settings

**Objective**: Manually sync settings to all group properties

```http
POST http://localhost:4000/api/v1/property-groups/507f1f77bcf86cd799439025/sync
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "settingsToSync": {
    "checkInTime": "15:00",
    "checkOutTime": "11:00"
  }
}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Settings synced to 2 properties",
  "data": {
    "propertiesUpdated": 2,
    "propertiesFailed": 0,
    "syncDuration": 234
  }
}
```

**Validation:**
- ✓ Status code: 200
- ✓ All properties updated
- ✓ No failures

---

## Error Testing

### Test 4.1: Missing Authentication

```http
POST http://localhost:4000/api/v1/settings/apply
Content-Type: application/json

{
  "scope": "single",
  "propertyId": "xxx",
  "settingType": "booking_rules",
  "settingUpdates": {}
}
```

**Expected Response:**
```json
{
  "status": "error",
  "message": "You are not logged in! Please log in to get access."
}
```

**Expected Status**: 401 Unauthorized

---

### Test 4.2: Invalid Scope

```http
POST http://localhost:4000/api/v1/settings/apply
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "scope": "invalid",
  "propertyId": "xxx",
  "settingType": "booking_rules",
  "settingUpdates": {}
}
```

**Expected Response:**
```json
{
  "status": "error",
  "message": "Invalid scope. Must be: single, group, or all"
}
```

**Expected Status**: 400 Bad Request

---

### Test 4.3: Property Not Found

```http
POST http://localhost:4000/api/v1/settings/apply
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "scope": "single",
  "propertyId": "000000000000000000000000",
  "settingType": "booking_rules",
  "settingUpdates": {}
}
```

**Expected Response:**
```json
{
  "status": "error",
  "message": "Property not found"
}
```

**Expected Status**: 404 Not Found

---

### Test 4.4: Missing Required Fields

```http
POST http://localhost:4000/api/v1/settings/apply
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "scope": "single"
}
```

**Expected Response:**
```json
{
  "status": "error",
  "message": "Missing required fields: scope, propertyId, settingType, settingUpdates"
}
```

**Expected Status**: 400 Bad Request

---

## Performance Testing

### Test 5.1: Bulk Update Performance

**Objective**: Test performance with large property groups

**Test Steps:**
1. Create group with 50 properties
2. Apply settings to group
3. Measure response time

**Success Criteria:**
- Response time < 2s for 50 properties
- All properties updated successfully
- No timeout errors

---

### Test 5.2: Cache Performance

**Objective**: Verify cache is working

**Test Steps:**
1. GET /inheritance-status/:propertyId (uncached)
2. Measure response time
3. GET /inheritance-status/:propertyId (cached)
4. Measure response time
5. Compare times

**Success Criteria:**
- Cached response < 50ms
- Uncached response < 200ms
- Cache hit improves performance by 50%+

---

## Load Testing

### Test 6.1: Concurrent Requests

**Objective**: Test API under load

**Tool**: Apache Bench (ab) or Artillery

```bash
# Test with 100 concurrent requests
ab -n 1000 -c 100 -H "Authorization: Bearer <token>" \
   http://localhost:4000/api/v1/property-groups
```

**Success Criteria:**
- All requests complete successfully
- Average response time < 500ms
- No 500 errors
- Server remains stable

---

## Integration Testing

### Test 7.1: Full Workflow

**Objective**: Test complete user workflow

**Steps:**
1. Create property group
2. Add properties to group
3. Get affected count
4. Apply settings to group
5. Verify inheritance status
6. Set property override
7. Get group summary
8. Remove override
9. Sync group settings

**Success Criteria:**
- All steps complete successfully
- Data consistency maintained
- No data loss or corruption

---

## Postman Collection

### Setup Postman Collection

1. **Import Collection**
   - Create new collection: "Multi-Property Settings API"
   - Add environment variables

2. **Environment Variables**
```json
{
  "baseUrl": "http://localhost:4000/api/v1",
  "token": "",
  "propertyId": "",
  "groupId": ""
}
```

3. **Pre-request Script** (for all requests)
```javascript
pm.request.headers.add({
  key: 'Authorization',
  value: 'Bearer ' + pm.environment.get('token')
});
```

4. **Tests** (example for POST requests)
```javascript
pm.test("Status code is 200", function () {
  pm.response.to.have.status(200);
});

pm.test("Response has success status", function () {
  var jsonData = pm.response.json();
  pm.expect(jsonData.status).to.eql("success");
});

pm.test("Response time is less than 500ms", function () {
  pm.expect(pm.response.responseTime).to.be.below(500);
});
```

---

## Automated Testing Script

### Jest Test Example

```javascript
const request = require('supertest');
const app = require('../src/server');

describe('Settings API', () => {
  let token;
  let propertyId;

  beforeAll(async () => {
    // Login and get token
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'password123'
      });

    token = res.body.token;
    propertyId = res.body.data.user.properties[0];
  });

  describe('POST /api/v1/settings/apply', () => {
    it('should apply settings to single property', async () => {
      const res = await request(app)
        .post('/api/v1/settings/apply')
        .set('Authorization', `Bearer ${token}`)
        .send({
          scope: 'single',
          propertyId,
          settingType: 'booking_rules',
          settingUpdates: {
            checkInTime: '14:00',
            checkOutTime: '12:00'
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.propertiesUpdated).toBe(1);
    });

    it('should return error for invalid scope', async () => {
      const res = await request(app)
        .post('/api/v1/settings/apply')
        .set('Authorization', `Bearer ${token}`)
        .send({
          scope: 'invalid',
          propertyId,
          settingType: 'booking_rules',
          settingUpdates: {}
        });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
    });
  });
});
```

---

## Testing Checklist

### Functional Testing
- [ ] All 25 endpoints respond correctly
- [ ] Authentication works for all endpoints
- [ ] Validation catches all error cases
- [ ] All setting types are supported
- [ ] All scopes work correctly
- [ ] Error messages are clear and helpful

### Integration Testing
- [ ] Frontend can consume all endpoints
- [ ] Database updates are correct
- [ ] Cache invalidation works
- [ ] WebSocket notifications fire (if implemented)

### Performance Testing
- [ ] Response times meet targets
- [ ] Bulk operations complete in reasonable time
- [ ] Cache improves performance
- [ ] No memory leaks

### Security Testing
- [ ] Unauthorized requests blocked
- [ ] Token validation works
- [ ] Property ownership verified
- [ ] SQL injection prevented
- [ ] XSS prevented

### Edge Cases
- [ ] Empty property groups handled
- [ ] Non-existent IDs handled
- [ ] Duplicate operations handled
- [ ] Concurrent updates handled

---

## Troubleshooting

### Common Issues

**Issue**: 401 Unauthorized
- **Solution**: Check token is valid and not expired

**Issue**: 404 Not Found
- **Solution**: Verify property/group IDs are correct

**Issue**: 500 Server Error
- **Solution**: Check server logs for details

**Issue**: Slow response times
- **Solution**: Check database indexes and Redis connection

---

## Next Steps

1. ✅ Run all manual tests in this guide
2. ✅ Create Postman collection with all endpoints
3. ✅ Write automated Jest tests
4. ✅ Perform load testing
5. ✅ Document any issues found
6. ✅ Fix bugs and retest

---

**Testing Status**: Ready for implementation
**Estimated Testing Time**: 4-6 hours for complete coverage
**Required Resources**: Postman, test data, MongoDB instance
