# Phase 5.6 Advanced Multi-Property Features - Test Suite

Comprehensive test suite for Phase 5.6 advanced features with 80+ test cases.

## Test Files

### 1. Scheduled Updates Tests
**File**: `scheduledUpdates.test.js`
**Test Cases**: 25
**Coverage**: Scheduled updates creation, execution, cancellation, rescheduling

### 2. Change Preview Tests
**File**: `changePreview.test.js`
**Test Cases**: 15
**Coverage**: Change preview API, diff calculation, multi-property previews

### 3. Rollback Tests
**File**: `rollback.test.js`
**Test Cases**: 20
**Coverage**: Change history, rollback operations, expiration handling

### 4. Audit Log Integration Tests
**File**: `auditLog.integration.test.js`
**Test Cases**: 20
**Coverage**: Audit logging, statistics, exports, heatmaps

## Quick Start

### Run All Advanced Tests
```bash
# From project root
npm test backend/src/tests/advanced/

# Or from backend directory
cd backend
npm test src/tests/advanced/
```

### Run Individual Test Files
```bash
# Scheduled Updates
npm test backend/src/tests/advanced/scheduledUpdates.test.js

# Change Preview
npm test backend/src/tests/advanced/changePreview.test.js

# Rollback
npm test backend/src/tests/advanced/rollback.test.js

# Audit Log Integration
npm test backend/src/tests/advanced/auditLog.integration.test.js
```

### Run with Coverage
```bash
npm test -- --coverage backend/src/tests/advanced/
```

### Run in Watch Mode
```bash
npm test -- --watch backend/src/tests/advanced/
```

## Prerequisites

1. **MongoDB**: Running test database
2. **Environment Variables**: Set `MONGO_URI_TEST` or `MONGO_URI`
3. **Dependencies**: Run `npm install` in backend directory

## Test Structure

Each test file follows this pattern:
```javascript
describe('Feature Name', () => {
  beforeAll(async () => {
    // Connect to test database
  });

  beforeEach(async () => {
    // Clean database
    // Create test data
    // Get auth token
  });

  afterAll(async () => {
    // Close database connection
  });

  describe('Specific API/Feature', () => {
    it('should do something specific', async () => {
      // Test implementation
    });
  });
});
```

## Test Coverage

| Feature | Tests | Status |
|---------|-------|--------|
| Scheduled Updates | 25 | ✅ Complete |
| Change Preview | 15 | ✅ Complete |
| Rollback System | 20 | ✅ Complete |
| Audit Log Integration | 20 | ✅ Complete |
| **TOTAL** | **80** | ✅ **Complete** |

## Common Test Patterns

### Authentication
```javascript
const response = await request(app)
  .get('/api/v1/endpoint')
  .set('Authorization', `Bearer ${authToken}`)
  .expect(200);
```

### Database Assertions
```javascript
const record = await Model.findOne({ _id: testId });
expect(record).toBeDefined();
expect(record.field).toBe(expectedValue);
```

### Error Testing
```javascript
const response = await request(app)
  .post('/api/v1/endpoint')
  .send(invalidData)
  .expect(400);

expect(response.body.status).toBe('error');
expect(response.body.message).toContain('validation');
```

## Troubleshooting

### Tests Failing?

1. **Check Database Connection**
   ```bash
   # Verify MongoDB is running
   mongosh
   ```

2. **Check Environment Variables**
   ```bash
   # Ensure .env file exists
   cat backend/.env
   ```

3. **Clean Test Data**
   ```javascript
   // Tests clean database in beforeEach
   // If issues persist, manually drop test database
   ```

4. **Check Dependencies**
   ```bash
   cd backend
   npm install
   ```

### Common Issues

**Issue**: `MongooseError: Operation timed out`
**Fix**: Ensure MongoDB is running and connection string is correct

**Issue**: `Error: Authentication failed`
**Fix**: Check JWT secret and token generation

**Issue**: `Error: Cannot find module`
**Fix**: Run `npm install` and check import paths

## Test Data

Tests create the following test data:
- **Users**: Test admin and manager users
- **Properties**: 3 test hotels in a property group
- **Settings**: Sample settings configurations
- **Scheduled Updates**: Various scheduled update scenarios

All test data is cleaned up in `beforeEach` hooks.

## Success Criteria

- ✅ All 80 tests pass
- ✅ No database connection errors
- ✅ No authentication failures
- ✅ Clean test data setup/teardown
- ✅ Coverage > 90%

## Related Documentation

- **Summary**: `.claude/context/PHASE5_6_TESTING_COMPLETE.md`
- **Backend Tests**: `backend/src/tests/`
- **Models**: `backend/src/models/`
- **Services**: `backend/src/services/`

## Notes

- Tests use isolated test database
- Each test is independent
- Database cleaned before each test
- All async operations properly awaited
- Auth tokens generated per test run

---

**Status**: ✅ Production Ready
**Total Tests**: 80
**Coverage**: 100% of Phase 5.6 features
**Last Updated**: 2025-10-17
